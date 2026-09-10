import * as CollectionsRepository from "@nildb/collections/collections.repository";
import type { CollectionDocument } from "@nildb/collections/collections.types";
import { buildAclFilter } from "@nildb/common/acl";
import {
  type CollectionNotFoundError,
  type DatabaseError,
  DataValidationError,
  ResourceAccessDeniedError,
} from "@nildb/common/errors";
import type { AppBindings } from "@nildb/env";
import { Effect as E, pipe } from "effect";
import { UUID } from "mongodb";

/**
 * Aggregation stages a builder may use.
 *
 * This mirrors `mongodb_pipeline.json`, which only validates the *top level*
 * of a pipeline: `$lookup.pipeline` and `$facet` values are typed as plain
 * objects there, so a nested stage bypasses that schema entirely. The set is
 * re-checked here, at every depth.
 */
const ALLOWED_STAGES: ReadonlySet<string> = new Set([
  "$match",
  "$lookup",
  "$project",
  "$group",
  "$sort",
  "$limit",
  "$skip",
  "$unwind",
  "$addFields",
  "$count",
  "$replaceRoot",
  "$facet",
  "$bucket",
  "$bucketAuto",
  "$sortByCount",
  "$merge",
  "$out",
]);

/** Stages that name another collection. Each needs an authorisation decision. */
const COLLECTION_REFERENCING_STAGES: ReadonlySet<string> = new Set(["$lookup", "$out", "$merge"]);

/** Guards against pathologically nested `$lookup`/`$facet` sub-pipelines. */
const MAX_PIPELINE_DEPTH = 5;

/** nilDB names every data collection after its UUID. */
const COLLECTION_NAME_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type CollectionReferences = {
  /** Collections the pipeline reads from, via `$lookup`. */
  reads: Set<string>;
  /** Collections the pipeline writes to, via `$out` or `$merge`. */
  writes: Set<string>;
};

class PipelineStructureError extends Error {}

function fail(message: string): never {
  throw new PipelineStructureError(message);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Resolve the collection named by a `$out` / `$merge` target or a
 * `$lookup.from`.
 *
 * A target may be a bare collection name or a `{ db, coll }` pair. The pair
 * form can address a different database entirely, which would step outside the
 * data database, so it is only accepted when it names no database.
 */
function resolveTargetName(stage: string, target: unknown): string {
  if (typeof target === "string") {
    return target;
  }

  if (isRecord(target)) {
    if ("db" in target) {
      fail(`${stage} may not target another database`);
    }
    const coll = target.coll;
    if (typeof coll === "string") {
      return coll;
    }
  }

  return fail(`${stage} has an unsupported collection target`);
}

function assertKnownCollectionName(stage: string, name: string): void {
  if (!COLLECTION_NAME_PATTERN.test(name)) {
    fail(`${stage} may only reference a collection by its uuid, got '${name}'`);
  }
}

/**
 * Walk a pipeline, enforcing the stage allowlist at every depth and recording
 * every collection the pipeline reads from or writes to.
 */
function collectReferences(stages: unknown, refs: CollectionReferences, depth: number): void {
  if (depth > MAX_PIPELINE_DEPTH) {
    fail(`Pipeline nesting exceeds the maximum depth of ${MAX_PIPELINE_DEPTH}`);
  }

  if (!Array.isArray(stages)) {
    fail("Pipeline must be an array of stages");
  }

  for (const stage of stages) {
    if (!isRecord(stage)) {
      fail("Each pipeline stage must be an object");
    }

    const names = Object.keys(stage);
    if (names.length !== 1) {
      fail("Each pipeline stage must have exactly one operator");
    }

    const name = names[0];
    if (!ALLOWED_STAGES.has(name)) {
      fail(`Pipeline stage '${name}' is not permitted`);
    }

    const body = stage[name];

    if (name === "$lookup") {
      if (!isRecord(body)) {
        fail("$lookup must be an object");
      }
      const from = resolveTargetName("$lookup", body.from);
      assertKnownCollectionName("$lookup", from);
      refs.reads.add(from.toLowerCase());

      if (body.pipeline !== undefined) {
        collectReferences(body.pipeline, refs, depth + 1);
      }
      continue;
    }

    if (name === "$out") {
      const target = resolveTargetName("$out", body);
      assertKnownCollectionName("$out", target);
      refs.writes.add(target.toLowerCase());
      continue;
    }

    if (name === "$merge") {
      const into = isRecord(body) ? body.into : body;
      const target = resolveTargetName("$merge", into);
      assertKnownCollectionName("$merge", target);
      refs.writes.add(target.toLowerCase());

      // `whenMatched` may itself be a pipeline. MongoDB restricts it to
      // field-level stages, so rather than applying the full allowlist we
      // only ensure it names no further collections.
      if (isRecord(body) && Array.isArray(body.whenMatched)) {
        for (const sub of body.whenMatched) {
          if (isRecord(sub) && Object.keys(sub).some((key) => COLLECTION_REFERENCING_STAGES.has(key))) {
            fail("$merge.whenMatched may not reference another collection");
          }
        }
      }
      continue;
    }

    if (name === "$facet") {
      if (!isRecord(body)) {
        fail("$facet must be an object");
      }
      for (const facet of Object.values(body)) {
        collectReferences(facet, refs, depth + 1);
      }
    }
  }
}

/**
 * Rewrite every `$lookup` into an owned collection so its sub-pipeline starts
 * with that collection's ACL predicate.
 *
 * Owned collections grant access per document, so a bare `$lookup` would
 * return documents the requester may not read. MongoDB allows `pipeline`
 * alongside `localField`/`foreignField`, so the predicate can be prepended
 * without changing the join semantics.
 */
function injectLookupAcls(
  stages: Record<string, unknown>[],
  requesterId: string,
  ownedCollections: ReadonlySet<string>,
): Record<string, unknown>[] {
  return stages.map((stage) => {
    const name = Object.keys(stage)[0];
    const body = stage[name];

    if (name === "$lookup" && isRecord(body)) {
      const from = resolveTargetName("$lookup", body.from).toLowerCase();
      const nested = Array.isArray(body.pipeline)
        ? injectLookupAcls(body.pipeline as Record<string, unknown>[], requesterId, ownedCollections)
        : undefined;

      if (!ownedCollections.has(from)) {
        return nested ? { $lookup: { ...body, pipeline: nested } } : stage;
      }

      return {
        $lookup: {
          ...body,
          pipeline: [{ $match: buildAclFilter(requesterId, "read") }, ...(nested ?? [])],
        },
      };
    }

    if (name === "$facet" && isRecord(body)) {
      const rewritten: Record<string, unknown> = {};
      for (const [facetName, facetStages] of Object.entries(body)) {
        rewritten[facetName] = Array.isArray(facetStages)
          ? injectLookupAcls(facetStages as Record<string, unknown>[], requesterId, ownedCollections)
          : facetStages;
      }
      return { $facet: rewritten };
    }

    return stage;
  });
}

/**
 * Validate a builder's aggregation pipeline and authorise every collection it
 * names, returning a pipeline that is safe to execute.
 *
 * The top-level `$match` that `buildAccessControlledFilter` prepends only
 * constrains the source collection. `$lookup`, `$out` and `$merge` address
 * other collections by name and would otherwise read or overwrite another
 * tenant's data.
 *
 * Authorisation rules:
 * - `$lookup` into a standard collection requires ownership.
 * - `$lookup` into an owned collection is allowed, with the per-document ACL
 *   predicate injected into the join (matching how `find` treats them).
 * - `$out` / `$merge` require a standard collection owned by the requester.
 *   Owned collections are refused outright: a bulk write would replace the
 *   `_owner`/`_acl` fields the ACL model depends on and desynchronise the
 *   per-user document references.
 *
 * Note that `$out` and `$merge` still bypass the collection's JSON schema,
 * which is enforced in application code on insert rather than by MongoDB. They
 * can only do so to the requester's own collections.
 */
export function guardPipeline(
  ctx: AppBindings,
  requesterId: string,
  pipeline: Record<string, unknown>[],
): E.Effect<
  Record<string, unknown>[],
  ResourceAccessDeniedError | DataValidationError | CollectionNotFoundError | DatabaseError
> {
  const refs: CollectionReferences = { reads: new Set(), writes: new Set() };

  try {
    collectReferences(pipeline, refs, 0);
  } catch (cause) {
    if (cause instanceof PipelineStructureError) {
      return E.fail(new DataValidationError({ issues: [cause.message], cause }));
    }
    throw cause;
  }

  const referenced = [...new Set([...refs.reads, ...refs.writes])];
  if (referenced.length === 0) {
    return E.succeed(pipeline);
  }

  return pipe(
    CollectionsRepository.findAll(ctx, { _id: { $in: referenced.map((id) => new UUID(id)) } }),
    E.flatMap((collections) => {
      const byId = new Map<string, CollectionDocument>(
        collections.map((collection) => [collection._id.toString().toLowerCase(), collection]),
      );

      const deny = (id: string): E.Effect<never, ResourceAccessDeniedError> =>
        E.fail(
          new ResourceAccessDeniedError({
            type: "collection",
            id,
            user: requesterId,
          }),
        );

      for (const id of refs.writes) {
        const collection = byId.get(id);
        // An unknown collection is refused rather than created implicitly:
        // `$out` would otherwise let a builder create arbitrary collections.
        if (!collection || collection.type !== "standard" || collection.owner !== requesterId) {
          return deny(id);
        }
      }

      const owned = new Set<string>();
      for (const id of refs.reads) {
        const collection = byId.get(id);
        if (!collection) {
          return deny(id);
        }
        if (collection.type === "owned") {
          owned.add(id);
          continue;
        }
        if (collection.owner !== requesterId) {
          return deny(id);
        }
      }

      return E.succeed(injectLookupAcls(pipeline, requesterId, owned));
    }),
  );
}

/**
 * Structural validation only, for use when a query is created.
 *
 * Authorisation is deliberately not checked here: ownership and ACLs can
 * change between creating a query and running it, so `guardPipeline` remains
 * the authority at execution time. This exists to reject a malformed or
 * disallowed pipeline early.
 */
export function validatePipelineStructure(pipeline: Record<string, unknown>[]): E.Effect<void, DataValidationError> {
  try {
    collectReferences(pipeline, { reads: new Set(), writes: new Set() }, 0);
    return E.succeed(void 0);
  } catch (cause) {
    if (cause instanceof PipelineStructureError) {
      return E.fail(new DataValidationError({ issues: [cause.message], cause }));
    }
    throw cause;
  }
}
