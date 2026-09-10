import type { CollectionDocument } from "@nildb/collections/collections.types";
import { guardPipeline, validatePipelineStructure } from "@nildb/queries/pipeline.guard";
import { Effect as E, Exit } from "effect";
import { UUID } from "mongodb";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockFindAll } = vi.hoisted(() => ({ mockFindAll: vi.fn() }));

vi.mock("@nildb/collections/collections.repository", () => ({
  findAll: mockFindAll,
}));

const requester = "did:key:zrequester";
const otherBuilder = "did:key:zother";

const ownStandard = "11111111-1111-4111-8111-111111111111";
const foreignStandard = "22222222-2222-4222-8222-222222222222";
const ownedCollection = "33333333-3333-4333-8333-333333333333";

function collection(id: string, type: "standard" | "owned", owner: string): CollectionDocument {
  return {
    _id: new UUID(id),
    name: `c-${id}`,
    type,
    owner,
    schema: {},
    _created: new Date(),
    _updated: new Date(),
  };
}

const ctx = {} as never;

describe("guardPipeline", () => {
  beforeEach(() => {
    mockFindAll.mockReset();
    mockFindAll.mockImplementation(() =>
      E.succeed([
        collection(ownStandard, "standard", requester),
        collection(foreignStandard, "standard", otherBuilder),
        collection(ownedCollection, "owned", otherBuilder),
      ]),
    );
  });

  it("passes through a pipeline that names no other collection", () => {
    const pipeline = [{ $match: { a: 1 } }, { $limit: 10 }];

    const result = E.runSync(guardPipeline(ctx, requester, pipeline));

    expect(result).toEqual(pipeline);
    // No collection references means no reason to hit the database.
    expect(mockFindAll).not.toHaveBeenCalled();
  });

  it("allows $lookup into a standard collection the requester owns", () => {
    const pipeline = [{ $lookup: { from: ownStandard, localField: "a", foreignField: "b", as: "joined" } }];

    const result = E.runSync(guardPipeline(ctx, requester, pipeline));

    expect(result).toEqual(pipeline);
  });

  it("denies $lookup into a standard collection owned by another builder", () => {
    const pipeline = [{ $lookup: { from: foreignStandard, localField: "a", foreignField: "b", as: "joined" } }];

    const exit = E.runSyncExit(guardPipeline(ctx, requester, pipeline));

    expect(Exit.isFailure(exit)).toBe(true);
  });

  it("injects the per-document acl predicate when joining an owned collection", () => {
    const pipeline = [{ $lookup: { from: ownedCollection, localField: "a", foreignField: "b", as: "joined" } }];

    const result = E.runSync(guardPipeline(ctx, requester, pipeline)) as Record<string, never>[];
    const lookup = result[0].$lookup as unknown as { pipeline: unknown[] };

    expect(lookup.pipeline[0]).toEqual({
      $match: { _acl: { $elemMatch: { grantee: requester, read: true } } },
    });
  });

  it("denies $out into a collection the requester does not own", () => {
    const exit = E.runSyncExit(guardPipeline(ctx, requester, [{ $out: foreignStandard }]));

    expect(Exit.isFailure(exit)).toBe(true);
  });

  it("denies $out into an unknown collection", () => {
    const exit = E.runSyncExit(guardPipeline(ctx, requester, [{ $out: "44444444-4444-4444-8444-444444444444" }]));

    expect(Exit.isFailure(exit)).toBe(true);
  });

  it("denies $merge into an owned collection even for the collection owner", () => {
    mockFindAll.mockImplementation(() => E.succeed([collection(ownedCollection, "owned", requester)]));

    const exit = E.runSyncExit(guardPipeline(ctx, requester, [{ $merge: { into: ownedCollection } }]));

    expect(Exit.isFailure(exit)).toBe(true);
  });

  it("allows $out into a standard collection the requester owns", () => {
    const pipeline = [{ $out: ownStandard }];

    expect(E.runSync(guardPipeline(ctx, requester, pipeline))).toEqual(pipeline);
  });

  it("denies a cross-database $out target", () => {
    const exit = E.runSyncExit(guardPipeline(ctx, requester, [{ $out: { db: "admin", coll: ownStandard } }]));

    expect(Exit.isFailure(exit)).toBe(true);
  });

  it("denies a disallowed stage nested inside a $lookup sub-pipeline", () => {
    // The json schema only validated the top level, so this used to slip past.
    const exit = E.runSyncExit(
      guardPipeline(ctx, requester, [
        { $lookup: { from: ownStandard, as: "joined", pipeline: [{ $unionWith: foreignStandard }] } },
      ]),
    );

    expect(Exit.isFailure(exit)).toBe(true);
  });

  it("authorises collections referenced from a nested sub-pipeline", () => {
    const exit = E.runSyncExit(
      guardPipeline(ctx, requester, [
        { $lookup: { from: ownStandard, as: "joined", pipeline: [{ $lookup: { from: foreignStandard, as: "x" } }] } },
      ]),
    );

    expect(Exit.isFailure(exit)).toBe(true);
  });

  it("authorises collections referenced from a $facet branch", () => {
    const exit = E.runSyncExit(
      guardPipeline(ctx, requester, [{ $facet: { a: [{ $lookup: { from: foreignStandard, as: "x" } }] } }]),
    );

    expect(Exit.isFailure(exit)).toBe(true);
  });
});

describe("validatePipelineStructure", () => {
  it("accepts a well-formed pipeline", () => {
    expect(Exit.isSuccess(E.runSyncExit(validatePipelineStructure([{ $match: {} }])))).toBe(true);
  });

  it("rejects a stage with more than one operator", () => {
    expect(Exit.isFailure(E.runSyncExit(validatePipelineStructure([{ $match: {}, $limit: 1 }])))).toBe(true);
  });

  it("rejects a non-uuid collection reference", () => {
    expect(Exit.isFailure(E.runSyncExit(validatePipelineStructure([{ $out: "system.users" }])))).toBe(true);
  });

  it("rejects nesting beyond the depth limit", () => {
    let nested: Record<string, unknown>[] = [{ $match: {} }];
    for (let i = 0; i < 7; i++) {
      nested = [{ $lookup: { from: ownStandard, as: "x", pipeline: nested } }];
    }

    expect(Exit.isFailure(E.runSyncExit(validatePipelineStructure(nested)))).toBe(true);
  });
});
