import { zValidator } from "@hono/zod-validator";
import { Effect as E } from "effect";
import { StatusCodes } from "http-status-codes";
import { Temporal } from "temporal-polyfill";
import type { Schema, ZodError } from "zod";
import { DataValidationError } from "#/common/errors";
import { fromZodError } from "zod-validation-error";

export function flattenZodError(error: ZodError): string[] {
  const errorMessage = fromZodError(error, {
    prefix: null,
    issueSeparator: ";",
  }).message;

  const reasons = errorMessage.split(";");
  return reasons;
}

export function payloadValidator<T extends Schema>(schema: T) {
  return zValidator("json", schema, (result, c) => {
    if (result.success) {
      return result.data;
    }

    const errors = flattenZodError(result.error);
    return c.json(
      { ts: Temporal.Now.instant().toString(), errors },
      StatusCodes.BAD_REQUEST,
    );
  });
}

export function paramsValidator<T extends Schema>(schema: T) {
  return zValidator("param", schema, (result, c) => {
    if (result.success) {
      return result.data;
    }

    const errors = flattenZodError(result.error);
    return c.json(
      { ts: Temporal.Now.instant().toString(), errors },
      StatusCodes.BAD_REQUEST,
    );
  });
}

export function parseToEffect<T, S extends Schema = Schema>(
  schema: S,
  data: unknown,
): E.Effect<T, DataValidationError> {
  const result = schema.safeParse(data);

  if (result.success) {
    return E.succeed(result.data);
  }

  const error = new DataValidationError({
    issues: flattenZodError(result.error),
    cause: data,
  });
  return E.fail(error);
}
