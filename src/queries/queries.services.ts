import { Effect as E, pipe } from "effect";
import type { Document, UUID } from "mongodb";
import type { JsonObject, JsonValue } from "type-fest";
import { z } from "zod";
import {
  type DataCollectionNotFoundError,
  DataValidationError,
  type DatabaseError,
  type DocumentNotFoundError,
  type PrimaryCollectionNotFoundError,
  VariableInjectionError,
} from "#/common/errors";
import type { NilDid } from "#/common/nil-did";
import { validateData } from "#/common/validator";
import * as DataRepository from "#/data/data.repository";
import type { AppBindings } from "#/env";
import * as OrganizationRepository from "#/organizations/organizations.repository";
import pipelineSchema from "./mongodb_pipeline.json";
import * as QueriesRepository from "./queries.repository";
import type { AddQueryRequest, ExecuteQueryRequest } from "./queries.types";
import type { QueryArrayVariable, QueryDocument } from "./queries.types";

export function addQuery(
  ctx: AppBindings,
  request: AddQueryRequest & { owner: NilDid },
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
  owner: NilDid,
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
