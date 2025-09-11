import { Effect as E, pipe } from "effect";
import { cloneDeep, set } from "es-toolkit/compat";
import type { Document, UUID } from "mongodb";
import { z } from "zod";
import * as BuildersService from "#/builders/builders.services";
import * as CollectionsService from "#/collections/collections.services";
import { enforceBuilderOwnership } from "#/common/acl";
import { applyCoercions } from "#/common/coercion";
import {
  type CollectionNotFoundError,
  type DatabaseError,
  DataValidationError,
  type DocumentNotFoundError,
  type ResourceAccessDeniedError,
  TimeoutError,
  type VariableInjectionError,
} from "#/common/errors";
import { validateData } from "#/common/validator";
import * as DataService from "#/data/data.services";
import type { AppBindings } from "#/env";
import pipelineSchema from "./mongodb_pipeline.json";
import * as RunQueryJobsRepository from "./queries.jobs.repository";
import * as QueriesRepository from "./queries.repository";
import type {
  AddQueryCommand,
  DeleteQueryCommand,
  GetQueryRunByIdCommand,
  QueryDocument,
  QueryVariable,
  ReadQueryByIdCommand,
  RunQueryCommand,
  RunQueryJobDocument,
} from "./queries.types";

/**
 * Add query.
 */
export function addQuery(
  ctx: AppBindings,
  command: AddQueryCommand,
): E.Effect<
  void,
  | VariableInjectionError
  | DataValidationError
  | DocumentNotFoundError
  | CollectionNotFoundError
  | DatabaseError
  | ResourceAccessDeniedError
> {
  const now = new Date();
  const document: QueryDocument = {
    _id: command._id,
    name: command.name,
    collection: command.collection,
    variables: command.variables,
    pipeline: command.pipeline,
    owner: command.owner,
    _created: now,
    _updated: now,
  };

  return pipe(
    validateData(pipelineSchema, document.pipeline),
    E.flatMap(() => CollectionsService.find(ctx, { _id: document.collection })),
    E.flatMap((collection) =>
      enforceBuilderOwnership(
        document.owner,
        collection.owner,
        "collection",
        collection._id,
      ),
    ),
    E.flatMap(() => QueriesRepository.insert(ctx, document)),
    E.flatMap(() =>
      BuildersService.addQuery(ctx, {
        did: document.owner,
        query: document._id,
      }),
    ),
    E.tap(() => ctx.cache.builders.taint(document.owner)),
    E.as(void 0),
  );
}

/**
 * Execute an effect in the background (fire and forget).
 */
function executeInBackground(
  ctx: AppBindings,
  runId: UUID,
  effect: E.Effect<
    void,
    DocumentNotFoundError | CollectionNotFoundError | DatabaseError
  >,
): void {
  pipe(effect, E.runPromiseExit)
    .then((exit) => {
      ctx.log.info(
        { run: runId.toString(), result: exit._tag },
        "Query run finished",
      );
    })
    .catch((error: unknown) => {
      ctx.log.warn(
        { run: runId.toString(), error },
        "Query run threw an unhandled error",
      );
    });
}

/**
 * Process and run a query.
 */
function processAndRunQuery(
  ctx: AppBindings,
  query: QueryDocument,
  runId: UUID,
  command: RunQueryCommand,
): E.Effect<
  void,
  DocumentNotFoundError | CollectionNotFoundError | DatabaseError
> {
  return pipe(
    E.Do,
    E.bind("variables", () =>
      validateVariables(query.variables, command.variables),
    ),
    E.bind("pipeline", ({ variables }) =>
      injectVariablesIntoAggregation(
        query.variables,
        query.pipeline,
        variables,
      ),
    ),
    E.flatMap(({ pipeline }) =>
      DataService.runAggregation(ctx, query, pipeline, command.requesterId),
    ),
    E.timeoutFail({
      duration: "30 minutes",
      onTimeout: () =>
        new TimeoutError({
          message: "Run query job timed out after 30 minutes.",
        }),
    }),
    E.flatMap((result) =>
      RunQueryJobsRepository.updateOne(ctx, runId, {
        status: "complete",
        completed: new Date(),
        result,
      }),
    ),
    E.catchAll((error) =>
      RunQueryJobsRepository.updateOne(ctx, runId, {
        status: "error",
        completed: new Date(),
        errors: error.humanize(),
      }),
    ),
  );
}

/**
 * Run query in background.
 */
export function runQueryInBackground(
  ctx: AppBindings,
  command: RunQueryCommand,
): E.Effect<
  UUID,
  | DocumentNotFoundError
  | CollectionNotFoundError
  | DatabaseError
  | DataValidationError
  | VariableInjectionError
  | ResourceAccessDeniedError
> {
  return pipe(
    QueriesRepository.findOne(ctx, { _id: command._id }),
    E.tap((query) =>
      enforceBuilderOwnership(
        command.requesterId,
        query.owner,
        "query",
        command._id,
      ),
    ),
    E.flatMap((query) =>
      pipe(
        E.succeed(RunQueryJobsRepository.toRunQueryJobDocument(query._id)),
        E.flatMap((document) => RunQueryJobsRepository.insert(ctx, document)),
        E.tap((run) =>
          RunQueryJobsRepository.updateOne(ctx, run.insertedId, {
            status: "running",
            started: new Date(),
          }),
        ),
        E.tap((run) => {
          const runId = run.insertedId;
          const effect = processAndRunQuery(ctx, query, runId, command);
          executeInBackground(ctx, runId, effect);
        }),
        E.map((run) => run.insertedId),
      ),
    ),
  );
}

/**
 * Get query run job.
 */
export function getRunQueryJob(
  ctx: AppBindings,
  command: GetQueryRunByIdCommand,
): E.Effect<
  RunQueryJobDocument,
  DocumentNotFoundError | CollectionNotFoundError | DatabaseError
> {
  return RunQueryJobsRepository.findOne(ctx, { _id: command._id });
}

/**
 * Get query by id.
 */
export function getQueryById(
  ctx: AppBindings,
  command: ReadQueryByIdCommand,
): E.Effect<
  QueryDocument,
  | DocumentNotFoundError
  | CollectionNotFoundError
  | DatabaseError
  | DataValidationError
  | ResourceAccessDeniedError
> {
  return pipe(
    QueriesRepository.findOne(ctx, {
      _id: command._id,
    }),
    E.tap((query) =>
      enforceBuilderOwnership(
        command.requesterId,
        query.owner,
        "query",
        command._id,
      ),
    ),
  );
}

/**
 * Find queries by owner.
 */
export function findQueries(
  ctx: AppBindings,
  owner: string,
): E.Effect<
  QueryDocument[],
  | DocumentNotFoundError
  | CollectionNotFoundError
  | DatabaseError
  | DataValidationError
> {
  return pipe(QueriesRepository.findMany(ctx, { owner }));
}

/**
 * Remove query.
 */
export function removeQuery(
  ctx: AppBindings,
  command: DeleteQueryCommand,
): E.Effect<
  void,
  | DocumentNotFoundError
  | CollectionNotFoundError
  | DatabaseError
  | DataValidationError
  | ResourceAccessDeniedError
> {
  return pipe(
    QueriesRepository.findOne(ctx, {
      _id: command._id,
    }),
    E.tap((document) =>
      enforceBuilderOwnership(
        command.requesterId,
        document.owner,
        "query",
        command._id,
      ),
    ),
    E.flatMap((document) =>
      pipe(
        QueriesRepository.findOneAndDelete(ctx, { _id: document._id }),
        E.tap(() => ctx.cache.builders.taint(document.owner)),
        E.flatMap(() =>
          BuildersService.removeQuery(ctx, {
            did: document.owner,
            query: command._id,
          }),
        ),
      ),
    ),
    E.as(void 0),
  );
}

/**
 * Remove query.
 */
export function deleteBuilderQueries(
  ctx: AppBindings,
  builder: string,
): E.Effect<
  void,
  | DocumentNotFoundError
  | CollectionNotFoundError
  | DatabaseError
  | DataValidationError
> {
  return QueriesRepository.deleteMany(ctx, { owner: builder }).pipe(
    E.tap(() => ctx.cache.builders.taint(builder)),
  );
}

export type QueryPrimitive = string | number | boolean | Date | UUID;

export type QueryRuntimeVariables = Record<
  string,
  QueryPrimitive | QueryPrimitive[]
>;

/**
 * Validate query variables.
 */
export function validateVariables(
  template: QueryDocument["variables"],
  provided: Record<string, unknown>,
): E.Effect<QueryRuntimeVariables, DataValidationError> {
  const { $coerce: _$coerce, ...values } = provided;
  const providedKeys = Object.keys(values);
  const permittedKeys = Object.keys(template);

  const missingVariables = permittedKeys.filter(
    (item) =>
      !providedKeys.includes(item) && !(template[item].optional ?? false),
  );
  const unexpectedVariables = providedKeys.filter(
    (item) => !permittedKeys.includes(item),
  );
  if (missingVariables.length > 0 || unexpectedVariables.length > 0) {
    const issues = [
      "Query execution variables mismatch: ",
      ...missingVariables.map((variable) => `missing=${variable}`),
      ...unexpectedVariables.map((variable) => `unexpected=${variable}`),
    ];
    const error = new DataValidationError({
      issues,
      cause: {
        template,
        provided,
      },
    });
    return E.fail(error);
  }

  return pipe(
    E.forEach(Object.entries(values), ([key, value]) => {
      if (Array.isArray(value)) {
        return validateArray(key, value as unknown[]).pipe(E.map(() => value));
      }
      return primitiveType(key, value).pipe(E.map(() => value));
    }),
    E.flatMap(() => applyCoercions(provided)),
    E.map((r) => r as QueryRuntimeVariables),
  );
}

function validateArray<T = unknown>(
  key: string,
  value: unknown[],
): E.Effect<T, DataValidationError> {
  const allTypesEquals = (types: PrimitiveType[]) => {
    if (types.length === 0 || types.every((t) => t === types[0])) {
      return E.succeed(types);
    }
    const issues = ["Unsupported mixed-type array"];
    const error = new DataValidationError({
      issues,
      cause: { key, value },
    });
    return E.fail(error);
  };
  return E.forEach(value as unknown[], (item) => primitiveType(key, item)).pipe(
    E.andThen((types) => allTypesEquals(types)),
    E.andThen(() => E.succeed(value as T)),
  );
}

type PrimitiveType = "string" | "number" | "boolean";
function primitiveType(
  key: string,
  value: unknown,
): E.Effect<PrimitiveType, DataValidationError> {
  let result:
    | { data: QueryPrimitive; success: true }
    | { success: false; error: z.ZodError };

  result = z.string().safeParse(value, { error: (_iss) => key });
  if (result.success) {
    return E.succeed("string");
  }
  result = z.number().safeParse(value, { error: (_iss) => key });
  if (result.success) {
    return E.succeed("number");
  }
  result = z.boolean().safeParse(value, { error: (_iss) => key });
  if (result.success) {
    return E.succeed("boolean");
  }
  const issues = ["Unsupported value type"];
  const error = new DataValidationError({
    issues,
    cause: { key, value },
  });
  return E.fail(error);
}

/**
 * Inject variables into aggregation.
 */
export function injectVariablesIntoAggregation(
  queryVariables: Record<string, QueryVariable>,
  aggregation: Record<string, unknown>[],
  variables: QueryRuntimeVariables,
): E.Effect<Document[], VariableInjectionError> {
  const pipeline = cloneDeep(aggregation);

  for (const key in variables) {
    if (Object.hasOwn(variables, key)) {
      const variableInfo = queryVariables[key];
      const value = variables[key];

      // The path from the query definition uses `$.pipeline` which we need to remove
      const path = variableInfo.path.replace("$.pipeline", "");
      set(pipeline, path, value);
    }
  }
  return E.succeed(pipeline as Document[]);
}
