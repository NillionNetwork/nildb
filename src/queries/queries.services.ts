import { Effect as E, pipe } from "effect";
import type { Document, UUID } from "mongodb";
import type { JsonValue } from "type-fest";
import { z } from "zod";
import {
  type DataCollectionNotFoundError,
  DataValidationError,
  type DatabaseError,
  type DocumentNotFoundError,
  type PrimaryCollectionNotFoundError,
  VariableInjectionError,
} from "#/common/errors";
import type { Did } from "#/common/types";
import { validateData } from "#/common/validator";
import * as DataRepository from "#/data/data.repository";
import type { AppBindings } from "#/env";
import * as OrganizationRepository from "#/organizations/organizations.repository";
import pipelineSchema from "./mongodb_pipeline.json";
import * as QueriesRepository from "./queries.repository";
import type {
  AddQueryRequest,
  ExecuteQueryRequest,
  QueryArrayVariable,
  QueryDocument,
} from "./queries.types";

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

export type QueryPrimitive = string | number | boolean | Date;

export type QueryRuntimeVariables = Record<
  string,
  QueryPrimitive | QueryPrimitive[]
>;

export function validateVariables(
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

  const missingVariables = permittedKeys.filter(
    (item) => !providedKeys.includes(item),
  );
  if (missingVariables.length > 0) {
    const issues = [
      "Missing pipeline variables",
      ...missingVariables.map((variable) => `expected=${variable}`),
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
          E.map(
            (values) => [variableTemplate.path, values] as [string, unknown],
          ),
        );
      }

      return pipe(
        parsePrimitiveVariable(key, provided[key], type),
        E.map((value) => [variableTemplate.path, value] as [string, unknown]),
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
    if (!field) {
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

export function injectVariablesIntoAggregation(
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
    injectVariables(key, value),
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
