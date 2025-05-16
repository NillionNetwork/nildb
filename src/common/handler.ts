import { Effect as E, pipe } from "effect";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { StatusCodes } from "http-status-codes";
import { Temporal } from "temporal-polyfill";
import type {
  DatabaseError,
  DataCollectionNotFoundError,
  DataValidationError,
  DocumentNotFoundError,
  DuplicateEntryError,
  IndexNotFoundError,
  InvalidIndexOptionsError,
  PrimaryCollectionNotFoundError,
  ResourceAccessDeniedError,
  VariableInjectionError,
} from "#/common/errors";
import type { AppContext } from "#/env";

export type ApiSuccessResponse<T> = {
  data: T;
};

export type ApiErrorResponse = {
  errors: string[];
  ts: string;
};

export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse;

type KnownError =
  | DataCollectionNotFoundError
  | DataValidationError
  | DatabaseError
  | DocumentNotFoundError
  | DuplicateEntryError
  | IndexNotFoundError
  | InvalidIndexOptionsError
  | PrimaryCollectionNotFoundError
  | ResourceAccessDeniedError
  | VariableInjectionError;

export function handleTaggedErrors(c: AppContext) {
  const toResponse = (
    e: KnownError,
    statusCode: ContentfulStatusCode,
  ): E.Effect<Response> => {
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
        DataCollectionNotFoundError: (e) =>
          toResponse(e, StatusCodes.BAD_REQUEST),
        DataValidationError: (e) => toResponse(e, StatusCodes.BAD_REQUEST),
        DatabaseError: (e) => toResponse(e, StatusCodes.INTERNAL_SERVER_ERROR),
        DocumentNotFoundError: (e) => toResponse(e, StatusCodes.NOT_FOUND),
        DuplicateEntryError: (e) => toResponse(e, StatusCodes.BAD_REQUEST),
        IndexNotFoundError: (e) => toResponse(e, StatusCodes.NOT_FOUND),
        InvalidIndexOptionsError: (e) => toResponse(e, StatusCodes.BAD_REQUEST),
        PrimaryCollectionNotFoundError: (e) =>
          toResponse(e, StatusCodes.NOT_FOUND),
        ResourceAccessDeniedError: (e) => toResponse(e, StatusCodes.NOT_FOUND),
        VariableInjectionError: (e) => toResponse(e, StatusCodes.BAD_REQUEST),
      }),
    );
}
