import Ajv from "ajv";
import type { DataValidationCxt } from "ajv/dist/types";
import * as addFormats from "ajv-formats";
import { Effect as E } from "effect";
import { type ZodSafeParseResult, z } from "zod";
import { DataValidationError } from "#/common/errors";
import { Uuid } from "#/common/types";

export function validateSchema(
  schema: Record<string, unknown>,
): E.Effect<void, DataValidationError> {
  return E.try({
    try: () => {
      const ajv = new Ajv();
      registerFormats(ajv);
      registerCoercions(ajv);
      ajv.compile(schema);
    },
    catch: (cause) => {
      if (cause instanceof DataValidationError) {
        return cause;
      }

      const issues = [];
      if (cause instanceof Error && cause.message) {
        issues.push(cause.message);
      }
      return new DataValidationError({ issues, cause });
    },
  });
}

export function validateData<T>(
  schema: Record<string, unknown>,
  data: unknown,
): E.Effect<T, DataValidationError> {
  return E.try({
    try: () => {
      const ajv = new Ajv();
      registerFormats(ajv);
      registerCoercions(ajv);
      const validator = ajv.compile<T>(schema);

      if (validator(data)) {
        return data as T;
      }

      const cause = validator.errors ?? [];
      const issues = cause.map(
        (c) => `${c.instancePath}: ${c.message ?? "Unknown error"}`,
      );

      throw new DataValidationError({ issues, cause });
    },
    catch: (cause) => {
      if (cause instanceof DataValidationError) {
        return cause;
      }

      const issues = [];
      if (cause instanceof Error && cause.message) {
        issues.push(cause.message);
      }
      return new DataValidationError({ issues, cause });
    },
  });
}

function registerFormats(ajv: Ajv): void {
  addFormats.default(ajv);

  ajv.addFormat("numeric", {
    type: "string",
    validate: (str: string) => {
      const num = Number(str);
      return !Number.isNaN(num) && Number.isFinite(num);
    },
  });
}

type SupportedCoercions = "date-time" | "uuid" | "numeric";

function registerCoercions(ajv: Ajv): void {
  const coercers: Record<
    SupportedCoercions,
    (data: string) => ZodSafeParseResult<unknown>
  > = {
    "date-time": (data) =>
      z
        .preprocess((arg) => {
          if (arg === null || arg === undefined) return undefined;
          if (typeof arg !== "string") return undefined;
          return new Date(arg);
        }, z.date())
        .safeParse(data),
    uuid: (data) => Uuid.safeParse(data),
    numeric: (data) =>
      z
        .preprocess((arg) => {
          if (arg === null || arg === undefined) return undefined;
          return Number(arg);
        }, z.number())
        .safeParse(data),
  };

  ajv.addKeyword({
    keyword: "coerce",
    type: "string",
    modifying: true,
    compile: (_value: boolean, parent: Record<string, unknown>) => {
      const format = parent.format as SupportedCoercions;

      if (!format) {
        throw new DataValidationError({
          issues: ["Coerce keyword requires format to be specified"],
          cause: format,
        });
      }

      const coercer = coercers[format];
      if (!coercer) {
        throw new DataValidationError({
          issues: [`Unsupported format for coercion: ${format}`],
          cause: coercers,
        });
      }

      return (data: unknown, dataCtx?: DataValidationCxt): boolean => {
        if (typeof data !== "string") {
          return false;
        }

        const result = coercer(data);

        if (result.success && dataCtx?.parentData[dataCtx.parentDataProperty]) {
          dataCtx.parentData[dataCtx.parentDataProperty] = result.data;
          return true;
        }
        return false;
      };
    },
  });
}
