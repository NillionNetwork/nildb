import { zValidator } from "@hono/zod-validator";
import { StatusCodes } from "http-status-codes";
import { Temporal } from "temporal-polyfill";
import type { Schema, ZodError } from "zod";
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
