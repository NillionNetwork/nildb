import { UnknownException } from "effect/Cause";
import type { StatusCode } from "hono/dist/types/utils/http-status";
import { customAlphabet } from "nanoid";
import type { BaseLogger } from "pino";
import { ZodError } from "zod";

const prefixGenerator = customAlphabet("0123456789abcdefghijklmnopqrstuvwxyz");

export function createShortId(length = 4): string {
  return prefixGenerator(length);
}

export function findRootError(
  error: unknown,
  scope: string,
  log: BaseLogger,
): StatusCode {
  if (error instanceof ZodError) {
    log.error({ err: error }, scope);
    return 404;
  }

  if (error instanceof UnknownException) {
    log.error({ err: error.cause }, scope);
    return 400;
  }

  return 500;
}