import { ValidationError } from "ajv";
import { Effect as E, pipe } from "effect";
import type { Context } from "hono";
import type { JsonArray } from "type-fest";
import { ZodError } from "zod";
import type { AppEnv } from "#/app";
import { DbError } from "#/models/errors";

export type ApiPath = `/api/v1/${string}`;

export type ApiSuccessResponse<T> = {
  data: T;
};

export type ApiErrorResponse = {
  errors: JsonArray;
};

export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse;

type HandlerParams = {
  path: ApiPath;
  request: unknown;
  response: unknown;
};

export type Handler<T extends HandlerParams> = {
  path: T["path"];
  request: T["request"];
  response: ApiResponse<T["response"]>;
};

export function foldToApiResponse<T>(c: Context<AppEnv>) {
  return (effect: E.Effect<T, Error>): E.Effect<ApiResponse<T>> =>
    pipe(
      effect,
      E.match({
        onFailure: (e) => {
          c.var.Log.error(e);
          const errors = [];

          if (e instanceof ZodError) {
            errors.push(e.flatten());
          } else if (e instanceof DbError) {
            errors.push(e.sanitizedMessage());
          } else if (e instanceof ValidationError) {
            errors.push(...e.errors);
          } else {
            errors.push(e.message);
          }

          return {
            errors: errors as JsonArray,
          };
        },
        onSuccess: (data) => {
          return {
            data,
          };
        },
      }),
    );
}