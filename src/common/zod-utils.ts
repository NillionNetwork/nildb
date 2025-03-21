import { zValidator } from "@hono/zod-validator";
import { StatusCodes } from "http-status-codes";
import { Temporal } from "temporal-polyfill";
import type { Schema } from "zod";
import { DataValidationError } from "./errors";

export function payloadValidator<T extends Schema>(schema: T) {
  return zValidator("json", schema, (result, c) => {
    if (result.success) {
      return result.data;
    }

    const errors = new DataValidationError({
      issues: [result.error],
      cause: null,
    }).humanize();

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

    const errors = new DataValidationError({
      issues: [result.error],
      cause: null,
    }).humanize();

    return c.json(
      { ts: Temporal.Now.instant().toString(), errors },
      StatusCodes.BAD_REQUEST,
    );
  });
}
