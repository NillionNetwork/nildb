import { Effect as E, pipe } from "effect";
import type { Document, UUID } from "mongodb";
import type { JsonValue } from "type-fest";
import { z } from "zod";
import * as BuildersService from "#/builders/builders.services";
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
 * Get builder queries.
 */
export function getBuilderQueries(
  ctx: AppBindings,
  id: string,
): E.Effect<
  QueryDocument[],
  | DocumentNotFoundError
  | CollectionNotFoundError
  | DatabaseError
  | DataValidationError
> {
  return QueriesRepository.findMany(ctx, { owner: id });
}

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
    validateQuery(document),
    E.flatMap((_document) => validateData(pipelineSchema, document.pipeline)),
    E.flatMap(() => QueriesRepository.insert(ctx, document)),
    E.flatMap(() => {
      ctx.cache.builders.taint(document.owner);
      return BuildersService.addQuery(ctx, {
        did: document.owner,
        query: document._id,
      });
    }),
    E.as(void 0),
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
> {
  return pipe(
    E.succeed(RunQueryJobsRepository.toRunQueryJobDocument(command._id)),
    E.flatMap((document) => RunQueryJobsRepository.insert(ctx, document)),
    E.flatMap((run) => {
      const runId = run.insertedId;

      // Run query in background (fire and forget)
      const backgroundJob = pipe(
        E.Do,
        E.bind("job", () =>
          RunQueryJobsRepository.findOne(ctx, { _id: runId }),
        ),
        E.bind("query", ({ job }) =>
          QueriesRepository.findOne(ctx, { _id: job.query }),
        ),
        E.bind("variables", ({ query }) =>
          validateVariables(query.variables, command.variables),
        ),
        E.bind("update", ({ job }) =>
          RunQueryJobsRepository.updateOne(ctx, job._id, {
            status: "running",
            started: new Date(),
          }),
        ),
        E.bind("pipeline", ({ query, variables }) =>
          injectVariablesIntoAggregation(
            query.variables,
            query.pipeline,
            variables,
          ),
        ),
        E.flatMap(({ query, pipeline }) =>
          DataService.runAggregation(ctx, query, pipeline),
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
        E.runPromiseExit,
      );

      backgroundJob
        .then((exit) => {
          ctx.log.info(
            { run: runId.toString(), result: exit._tag },
            "Query run finished",
          );
        })
        .catch((error: unknown) => {
          ctx.log.warn(
            { run: runId.toString(), error },
            "Query run threw an unhandled error: ",
          );
        });

      return E.succeed(runId);
    }),
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
> {
  return QueriesRepository.findOne(ctx, { _id: command._id });
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
> {
  return pipe(
    QueriesRepository.findOneAndDelete(ctx, { _id: command._id }),
    E.tap((document) => ctx.cache.builders.taint(document.owner)),
    E.flatMap((document) =>
      BuildersService.removeQuery(ctx, {
        did: document.owner,
        query: command._id,
      }),
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

/**
 * Validate query.
 */
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
 * Inject variables into aggregation.
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
