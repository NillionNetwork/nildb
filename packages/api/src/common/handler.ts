import type {
  CollectionNotFoundError,
  DatabaseError,
  DataValidationError,
  DocumentNotFoundError,
  DuplicateEntryError,
  GrantAccessError,
  IndexNotFoundError,
  InvalidIndexOptionsError,
  ResourceAccessDeniedError,
  RevokeAccessError,
  VariableInjectionError,
} from "@nildb/common/errors";
import type { AppEnv } from "@nildb/env";
import { Effect as E, pipe } from "effect";
import type { Context } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { StatusCodes } from "http-status-codes";
import { Temporal } from "temporal-polyfill";

import type { ApiErrorResponse } from "@nillion/nildb-types";

export type ApiResponse<T> = { data: T } | ApiErrorResponse;

type KnownError =
  | CollectionNotFoundError
  | DataValidationError
  | DatabaseError
  | DocumentNotFoundError
  | DuplicateEntryError
  | IndexNotFoundError
  | InvalidIndexOptionsError
  | ResourceAccessDeniedError
  | VariableInjectionError
  | GrantAccessError
  | RevokeAccessError;

export function handleTaggedErrors(c: Context<AppEnv>) {
  const toResponse = (e: KnownError, statusCode: ContentfulStatusCode): E.Effect<Response> => {
    const errors = e.humanize();
    c.env.log.debug(errors);
    const payload: ApiErrorResponse = {
      ts: Temporal.Now.instant().toString(),
      errors,
    };
    return E.succeed(c.json(payload, statusCode));
  };

  return (effect: E.Effect<Response, KnownError>): E.Effect<Response> =>
    pipe(
      effect,
      E.catchTags({
        CollectionNotFoundError: (e) => {
          if (e.dbName === "data") {
            return toResponse(e, StatusCodes.BAD_REQUEST);
          }
          return toResponse(e, StatusCodes.NOT_FOUND);
        },
        DataValidationError: (e) => toResponse(e, StatusCodes.BAD_REQUEST),
        DatabaseError: (e) => toResponse(e, StatusCodes.INTERNAL_SERVER_ERROR),
        DocumentNotFoundError: (e) => toResponse(e, StatusCodes.NOT_FOUND),
        DuplicateEntryError: (e) => toResponse(e, StatusCodes.BAD_REQUEST),
        IndexNotFoundError: (e) => toResponse(e, StatusCodes.NOT_FOUND),
        InvalidIndexOptionsError: (e) => toResponse(e, StatusCodes.BAD_REQUEST),
        ResourceAccessDeniedError: (e) => toResponse(e, StatusCodes.NOT_FOUND),
        VariableInjectionError: (e) => toResponse(e, StatusCodes.BAD_REQUEST),
        GrantAccessError: (e) => toResponse(e, StatusCodes.UNAUTHORIZED),
        RevokeAccessError: (e) => toResponse(e, StatusCodes.UNAUTHORIZED),
      }),
    );
}
