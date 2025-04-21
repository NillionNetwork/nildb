import { Data, Effect as E, pipe } from "effect";
import type { Document, InsertOneResult } from "mongodb";
import type { UUID } from "mongodb";
import type { JsonObject, JsonValue } from "type-fest";
import { z } from "zod";
import {
  type DataCollectionNotFoundError,
  DataValidationError,
  type DatabaseError,
  type DocumentNotFoundError,
  type PrimaryCollectionNotFoundError,
  TimeoutError,
  VariableInjectionError,
} from "#/common/errors";
import type { Did } from "#/common/types";
import { validateData } from "#/common/validator";
import * as DataRepository from "#/data/data.repository";
import type { AppBindings } from "#/env";
import * as OrganizationRepository from "#/organizations/organizations.repository";
import pipelineSchema from "./mongodb_pipeline.json";
import * as QueriesJobsRepository from "./queries.jobs.repository";
import * as QueriesRepository from "./queries.repository";
import type {
  AddQueryRequest,
  ExecuteQueryRequest,
  QueryJobDocument,
  QueryJobStatus,
} from "./queries.types";
import type { QueryArrayVariable, QueryDocument } from "./queries.types";

export function addQuery(
  ctx: AppBindings,
  request: AddQueryRequest & { owner: Did },
): E.Effect<
  void,
  DocumentNotFoundError | PrimaryCollectionNotFoundError | DatabaseError
> {
  const now = new Date();
  const document: QueryDocument = {
    ...request,
    _created: now,
    _updated: now,
  };

  return pipe(
    validateData(pipelineSchema, request.pipeline),
    () => QueriesRepository.insert(ctx, document),
    E.flatMap(() =>
      E.all([
        E.succeed(ctx.cache.accounts.taint(document.owner)),
        OrganizationRepository.addQuery(ctx, document.owner, document._id),
      ]),
    ),
    E.as(void 0),
  );
}

export function executeQuery(
  ctx: AppBindings,
  request: ExecuteQueryRequest,
): E.Effect<
  JsonValue,
  | DocumentNotFoundError
  | DataCollectionNotFoundError
  | PrimaryCollectionNotFoundError
  | DatabaseError
  | DataValidationError
  | VariableInjectionError
> {
  if (request.background) {
    return pipe(
      addQueryJob(ctx, request.id),
      E.flatMap((job) => {
        E.runPromise(processQueryJob(ctx, job.insertedId, request.variables));
        return E.succeed({
          jobId: job.insertedId.toString(),
        });
      }),
    );
  }

  return E.Do.pipe(
    E.bind("query", () => QueriesRepository.findOne(ctx, { _id: request.id })),
    E.bind("variables", ({ query }) =>
      validateVariables(query.variables, request.variables),
    ),
    E.bind("pipeline", ({ query, variables }) =>
      injectVariablesIntoAggregation(query.pipeline, variables),
    ),
    E.flatMap(({ query, pipeline }) => {
      return pipe(DataRepository.runAggregation(ctx, query, pipeline));
    }),
  );
}

export function findQueries(
  ctx: AppBindings,
  owner: Did,
): E.Effect<
  QueryDocument[],
  DocumentNotFoundError | PrimaryCollectionNotFoundError | DatabaseError
> {
  return pipe(QueriesRepository.findMany(ctx, { owner }));
}

export function removeQuery(
  ctx: AppBindings,
  _id: UUID,
): E.Effect<
  void,
  DocumentNotFoundError | PrimaryCollectionNotFoundError | DatabaseError
> {
  return pipe(
    QueriesRepository.findOneAndDelete(ctx, { _id }),
    E.flatMap((document) =>
      E.all([
        E.succeed(ctx.cache.accounts.taint(document.owner)),
        OrganizationRepository.removeQuery(ctx, document.owner, _id),
      ]),
    ),
  );
}

export function findQueryJob(
  ctx: AppBindings,
  _id: UUID,
): E.Effect<
  QueryJobDocument,
  DocumentNotFoundError | PrimaryCollectionNotFoundError | DatabaseError
> {
  return pipe(QueriesJobsRepository.findOne(ctx, { _id }));
}

export function addQueryJob(
  ctx: AppBindings,
  queryId: UUID,
): E.Effect<
  InsertOneResult<QueryJobDocument>,
  DocumentNotFoundError | PrimaryCollectionNotFoundError | DatabaseError
> {
  const document = QueriesJobsRepository.toQueryJobDocument(queryId);
  return QueriesJobsRepository.insert(ctx, document);
}

export function updateQueryJob(
  ctx: AppBindings,
  payload: {
    jobId: UUID;
    status: QueryJobStatus;
    startedAt?: Date;
    endedAt?: Date;
    result?: JsonValue;
    error?:
      | DocumentNotFoundError
      | PrimaryCollectionNotFoundError
      | DatabaseError
      | DataValidationError
      | VariableInjectionError
      | DataCollectionNotFoundError
      | TimeoutError;
  },
): E.Effect<
  void,
  DocumentNotFoundError | PrimaryCollectionNotFoundError | DatabaseError
> {
  const now = new Date();
  const { jobId, error, status, ...rest } = payload;
  const update: Partial<QueryJobDocument> = {
    ...rest,
    status,
    _updated: now,
  };

  switch (status) {
    case "running":
      update.startedAt = now;
      break;
    case "complete":
      update.endedAt = now;
      break;
  }

  if (error instanceof Data.TaggedError) {
    update.errors = error.humanize();
  } else if (error instanceof Error) {
    update.errors = [error.message];
  }

  return pipe(QueriesJobsRepository.updateOne(ctx, jobId, update));
}

export function processQueryJob(
  ctx: AppBindings,
  jobId: UUID,
  variables: ExecuteQueryRequest["variables"],
): E.Effect<
  void,
  | DocumentNotFoundError
  | PrimaryCollectionNotFoundError
  | DatabaseError
  | DataValidationError
  | VariableInjectionError
  | DataCollectionNotFoundError
> {
  return pipe(
    findQueryJob(ctx, jobId),
    E.flatMap((job) =>
      E.all([
        updateQueryJob(ctx, {
          jobId,
          status: "running",
        }),
        pipe(
          executeQuery(ctx, {
            id: job.queryId,
            variables,
          }),
          E.timeoutFail({
            duration: "30 minutes",
            onTimeout: () =>
              new TimeoutError({
                message: "Query job timed out after 30 minutes.",
              }),
          }),
        ),
      ]),
    ),
    E.flatMap(([, result]) =>
      updateQueryJob(ctx, { jobId, status: "complete", result }),
    ),
    E.catchAll((error) =>
      updateQueryJob(ctx, { jobId, status: "complete", error }),
    ),
  );
}

export type QueryPrimitive = string | number | boolean | Date;

export type QueryRuntimeVariables = Record<
  string,
  QueryPrimitive | QueryPrimitive[]
>;

function validateVariables(
  template: QueryDocument["variables"],
  provided: ExecuteQueryRequest["variables"],
): E.Effect<QueryRuntimeVariables, DataValidationError> {
  const permittedTypes = ["array", "string", "number", "boolean", "date"];
  const providedKeys = Object.keys(provided);
  const permittedKeys = Object.keys(template);

  if (providedKeys.length !== permittedKeys.length) {
    const issues = [
      "Query execution variables count mismatch",
      `expected=${permittedKeys.length}, received=${providedKeys.length}`,
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
    providedKeys,
    // biome-ignore lint/complexity/noForEach: biome mistakes `Effect.forEach` for a conventional `for ... each`
    E.forEach((key) => {
      const variableTemplate = template[key];

      const type = variableTemplate.type.toLowerCase();
      if (!permittedTypes.includes(type)) {
        const issues = ["Unsupported type", `type=${type}`];
        const error = new DataValidationError({
          issues,
          cause: {
            template,
            provided,
          },
        });
        return E.fail(error);
      }

      if (type === "array") {
        const itemType = (template[key] as QueryArrayVariable).items.type;
        return pipe(
          provided[key] as unknown[],
          // biome-ignore lint/complexity/noForEach: biome doesn't recognise Effect.forEach
          E.forEach((item) => parsePrimitiveVariable(key, item, itemType)),
          E.map((values) => [key, values] as [string, unknown]),
        );
      }

      return pipe(
        parsePrimitiveVariable(key, provided[key], type),
        E.map((value) => [key, value] as [string, unknown]),
      );
    }),
    E.map((entries) => Object.fromEntries(entries) as QueryRuntimeVariables),
  );
}

function parsePrimitiveVariable(
  key: string,
  value: unknown,
  type: QueryPrimitive,
): E.Effect<QueryPrimitive, DataValidationError> {
  let result:
    | { data: QueryPrimitive; success: true }
    | { success: false; error: z.ZodError };

  switch (type) {
    case "string": {
      result = z.string().safeParse(value, { path: [key] });
      break;
    }
    case "number": {
      result = z.number().safeParse(value, { path: [key] });
      break;
    }
    case "boolean": {
      result = z.boolean().safeParse(value, { path: [key] });
      break;
    }
    case "date": {
      result = z
        .preprocess((arg) => {
          if (arg === null || arg === undefined) return undefined;
          if (typeof arg !== "string") return undefined;
          return new Date(arg);
        }, z.date())
        .safeParse(value, { path: [key] });

      break;
    }
    default: {
      const issues = ["Unsupported type"];
      const error = new DataValidationError({
        issues,
        cause: { key, value, type },
      });
      return E.fail(error);
    }
  }

  if (result.success) {
    return E.succeed(result.data);
  }

  const error = new DataValidationError({
    issues: [result.error],
    cause: null,
  });
  return E.fail(error);
}

export function injectVariablesIntoAggregation(
  aggregation: Record<string, unknown>[],
  variables: QueryRuntimeVariables,
): E.Effect<Document[], VariableInjectionError> {
  const prefixIdentifier = "##";

  const traverse = (
    current: unknown,
  ): E.Effect<JsonValue, VariableInjectionError> => {
    // if item is a string and has prefix identifier then attempt inplace injection
    if (typeof current === "string" && current.startsWith(prefixIdentifier)) {
      const key = current.split(prefixIdentifier)[1];

      if (key in variables) {
        return E.succeed(variables[key] as JsonValue);
      }
      const error = new VariableInjectionError({
        message: `Missing pipeline variable: ${current}`,
      });
      return E.fail(error);
    }

    // if item is an array then traverse each array element
    if (Array.isArray(current)) {
      return E.forEach(current, (e) => traverse(e));
    }

    // if item is an object then recursively traverse it
    if (typeof current === "object" && current !== null) {
      return E.forEach(Object.entries(current), ([key, value]) =>
        pipe(
          traverse(value),
          E.map((traversedValue) => [key, traversedValue] as const),
        ),
      ).pipe(E.map((entries) => Object.fromEntries(entries) as JsonObject));
    }

    // remaining types are primitives and therefore do not need traversal
    return E.succeed(current as JsonValue);
  };

  return traverse(aggregation as JsonValue).pipe(
    E.map((result) => result as Document[]),
  );
}
