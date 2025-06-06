import { Effect as E, pipe } from "effect";
import type { Document, InsertOneResult, UUID } from "mongodb";
import type { JsonValue } from "type-fest";
import { z } from "zod";
import {
  type CollectionNotFoundError,
  type DatabaseError,
  DataValidationError,
  type DocumentNotFoundError,
  type QueryValidationError,
  TimeoutError,
  VariableInjectionError,
} from "#/common/errors";
import { applyCoercions } from "#/common/mongo";
import type { Did } from "#/common/types";
import { validateData } from "#/common/validator";
import * as DataRepository from "#/data/data.repository";
import type { AppBindings } from "#/env";
import * as OrganizationRepository from "#/organizations/organizations.repository";
import pipelineSchema from "./mongodb_pipeline.json";
import * as QueriesJobsRepository from "./queries.jobs.repository";
import * as QueriesRepository from "./queries.repository";
import type {
  AddQueryCommand,
  DeleteQueryCommand,
  ExecuteQueryCommand,
  GetQueryJobCommand,
  QueryDocument,
  QueryJobDocument,
  QueryJobStatus,
  QueryVariable,
} from "./queries.types";

export function addQuery(
  ctx: AppBindings,
  command: AddQueryCommand,
): E.Effect<
  void,
  DocumentNotFoundError | CollectionNotFoundError | DatabaseError
> {
  const now = new Date();
  const document: QueryDocument = {
    _id: command._id,
    name: command.name,
    schema: command.schema,
    variables: command.variables,
    pipeline: command.pipeline,
    owner: command.owner,
    _created: now,
    _updated: now,
  };

  return pipe(
    validateQuery(document),
    () => validateData(pipelineSchema, document.pipeline),
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
  command: ExecuteQueryCommand,
): E.Effect<
  { jobId: string } | Record<string, unknown>[],
  | DocumentNotFoundError
  | CollectionNotFoundError
  | DatabaseError
  | DataValidationError
  | VariableInjectionError
> {
  if (command.background) {
    return pipe(
      addQueryJob(ctx, command.id),
      E.flatMap((job) => {
        // TODO(tim): address this ignored promise
        // TODO(tim): rename executeQuery -> que query? ... remove background: true?
        E.runPromise(processQueryJob(ctx, job.insertedId, command.variables));
        return E.succeed({
          jobId: job.insertedId.toString(),
        });
      }),
    );
  }

  return E.Do.pipe(
    E.bind("query", () => QueriesRepository.findOne(ctx, { _id: command.id })),
    E.bind("variables", ({ query }) =>
      validateVariables(query.variables, command.variables),
    ),
    E.bind("pipeline", ({ query, variables }) =>
      injectVariablesIntoAggregation(
        query.variables,
        query.pipeline,
        variables,
      ),
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
  | DocumentNotFoundError
  | CollectionNotFoundError
  | DatabaseError
  | DataValidationError
> {
  return pipe(QueriesRepository.findMany(ctx, { owner }));
}

export function removeQuery(
  ctx: AppBindings,
  command: DeleteQueryCommand,
): E.Effect<
  void,
  | DocumentNotFoundError
  | CollectionNotFoundError
  | DatabaseError
  | DataValidationError
> {
  return pipe(
    QueriesRepository.findOneAndDelete(ctx, { _id: command.id }),
    E.flatMap((document) =>
      E.all([
        E.succeed(ctx.cache.accounts.taint(document.owner)),
        OrganizationRepository.removeQuery(ctx, document.owner, command.id),
      ]),
    ),
    E.as(void 0),
  );
}

export function validateQuery(
  query: QueryDocument,
): E.Effect<QueryDocument, QueryValidationError> {
  const { variables, pipeline } = query;

  const validateVariableDefinition: (
    key: string,
    variable: QueryVariable,
  ) => E.Effect<QueryVariable, QueryValidationError> = (key, variable) => {
    return pipe(
      pathSegments(variable.path),
      E.andThen((segments) => getAggregationField(pipeline, segments)),
      E.andThen((value) => {
        if (Array.isArray(value)) {
          return validateArray(key, value as unknown[]).pipe(
            E.andThen(() => E.succeed(variable)),
          );
        }
        return primitiveType(key, value).pipe(
          E.andThen(() => E.succeed(variable)),
        );
      }),
    );
  };

  return E.forEach(Object.entries(variables), ([key, variable]) =>
    validateVariableDefinition(key, variable),
  ).pipe(E.map(() => query));
}

export function findQueryJob(
  ctx: AppBindings,
  command: GetQueryJobCommand,
): E.Effect<
  QueryJobDocument,
  DocumentNotFoundError | CollectionNotFoundError | DatabaseError
> {
  return pipe(QueriesJobsRepository.findOne(ctx, { _id: command.id }));
}

export function addQueryJob(
  ctx: AppBindings,
  queryId: UUID,
): E.Effect<
  InsertOneResult<QueryJobDocument>,
  DocumentNotFoundError | CollectionNotFoundError | DatabaseError
> {
  const document = QueriesJobsRepository.toQueryJobDocument(queryId);
  return QueriesJobsRepository.insert(ctx, document);
}

type QueryJobUpdatePayload = {
  jobId: UUID;
  status: QueryJobStatus;
  startedAt?: Date;
  endedAt?: Date;
  result?: JsonValue;
  error?:
    | DocumentNotFoundError
    | CollectionNotFoundError
    | DatabaseError
    | DataValidationError
    | VariableInjectionError
    | TimeoutError;
};

export function updateQueryJob(
  ctx: AppBindings,
  payload: QueryJobUpdatePayload,
): E.Effect<
  void,
  DocumentNotFoundError | CollectionNotFoundError | DatabaseError
> {
  const { jobId, error, ...rest } = payload;
  const update: Partial<QueryJobDocument> = {
    ...rest,
    _updated: new Date(),
  };

  if (error) {
    update.errors = error.humanize();
  }

  return pipe(QueriesJobsRepository.updateOne(ctx, jobId, update));
}

export function processQueryJob(
  ctx: AppBindings,
  jobId: UUID,
  variables: Record<string, unknown>,
): E.Effect<
  void,
  | DocumentNotFoundError
  | CollectionNotFoundError
  | DatabaseError
  | DataValidationError
  | VariableInjectionError
> {
  return pipe(
    findQueryJob(ctx, { id: jobId }),
    E.flatMap((job) =>
      E.all([
        updateQueryJob(ctx, {
          jobId,
          status: "running",
          startedAt: new Date(),
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
      updateQueryJob(ctx, {
        jobId,
        result: result as JsonValue,
        status: "complete",
        endedAt: new Date(),
      }),
    ),
    E.catchAll((error) =>
      updateQueryJob(ctx, {
        jobId,
        error,
        status: "complete",
        endedAt: new Date(),
      }),
    ),
  );
}

export type QueryPrimitive = string | number | boolean | Date | UUID;

export type QueryRuntimeVariables = Record<
  string,
  QueryPrimitive | QueryPrimitive[]
>;

/**
 * Validates query execution variables against template definitions.
 *
 * Ensures that all required variables are provided and no unexpected
 * variables are included. Applies type coercions and validates data types
 * for each variable according to the query template.
 *
 * @param template - Variable definitions from the query document
 * @param provided - Variable values provided for query execution
 * @returns Effect that succeeds with validated runtime variables or fails with validation error
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

  return E.forEach(Object.entries(values), ([key, value]) => {
    if (Array.isArray(value)) {
      return validateArray(key, value as unknown[]).pipe(E.map(() => value));
    }
    return primitiveType(key, value).pipe(E.map(() => value));
  }).pipe(E.andThen(() => applyCoercions<QueryRuntimeVariables>(provided)));
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

  result = z.string().safeParse(value, { path: [key] });
  if (result.success) {
    return E.succeed("string");
  }
  result = z.number().safeParse(value, { path: [key] });
  if (result.success) {
    return E.succeed("number");
  }
  result = z.boolean().safeParse(value, { path: [key] });
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

function getAggregationField(
  aggregation: unknown,
  variablePath: string[],
): E.Effect<unknown, VariableInjectionError> {
  let field = aggregation;
  const getField = (
    segment: string,
  ): E.Effect<unknown, VariableInjectionError, never> => {
    if (typeof field === "object") {
      const obj = field as Record<string, unknown>;
      field = obj[segment];
    } else if (Array.isArray(field)) {
      field = field[Number(segment)];
    } else {
      field = undefined;
    }
    if (field === undefined) {
      return E.fail(
        new VariableInjectionError({
          message: `Variable path not found: ${variablePath}`,
        }),
      );
    }
    return E.succeed(field);
  };
  return E.forEach(variablePath, getField).pipe(
    E.map((fields) => fields.pop()),
  );
}

/**
 * Injects runtime variable values into MongoDB aggregation pipeline.
 *
 * Replaces variable placeholders in the aggregation pipeline with actual
 * values using JSONPath-style variable definitions. Supports deep object
 * and array access for complex pipeline structures.
 *
 * @param queryVariables - Variable definitions with path specifications
 * @param aggregation - MongoDB aggregation pipeline stages
 * @param variables - Runtime variable values to inject
 * @returns Effect that succeeds with modified pipeline or fails with injection error
 */
export function injectVariablesIntoAggregation(
  queryVariables: Record<string, QueryVariable>,
  aggregation: Record<string, unknown>[],
  variables: QueryRuntimeVariables,
): E.Effect<Document[], VariableInjectionError> {
  const injectVariables = (
    path: string,
    value: QueryPrimitive | QueryPrimitive[],
  ): E.Effect<
    QueryPrimitive | QueryPrimitive[],
    VariableInjectionError,
    never
  > => {
    return E.Do.pipe(
      E.bind("segments", () => pathSegments(path)),
      E.bind("lastSegment", ({ segments }) => {
        const lastField = segments.pop();
        if (!segments || !lastField) {
          return E.fail(
            new VariableInjectionError({ message: "Invalid field path" }),
          );
        }
        return E.succeed(lastField);
      }),
      E.bind("container", ({ segments }) =>
        getAggregationField(aggregation, segments),
      ),
      E.map(({ container, lastSegment }) => {
        if (typeof container === "object") {
          const obj = container as Record<string, unknown>;
          obj[lastSegment] = value;
        } else if (Array.isArray(container)) {
          container[Number(lastSegment)] = value;
        } else {
          return E.fail(
            new VariableInjectionError({
              message: `Variable path not found: ${path}`,
            }),
          );
        }
        return E.succeed(value);
      }),
      E.runSync,
    );
  };

  return E.forEach(Object.entries(variables), ([key, value]) =>
    injectVariables(queryVariables[key].path, value),
  ).pipe(E.map((_) => aggregation as JsonValue as Document[]));
}

function pathSegments(
  path: string,
): E.Effect<string[], VariableInjectionError> {
  const segments = path
    .split(".")
    .flatMap((segment) => segment.replace("]", "").split("["));
  const root = segments.shift();
  if (root && root !== "$") {
    return E.fail(
      new VariableInjectionError({
        message:
          "Relative path is not supported, the path must start by the root ($)",
      }),
    );
  }
  const pipeline = segments.shift();
  if (pipeline && pipeline !== "pipeline") {
    return E.fail(
      new VariableInjectionError({
        message: `Path for pipeline not found ${pipeline}`,
      }),
    );
  }

  return E.succeed(segments.filter(Boolean));
}
