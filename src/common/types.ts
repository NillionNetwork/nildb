import { UUID } from "mongodb";
import { z } from "zod";
import type { App } from "#/app";
import type { AppBindings } from "#/env";

/**
 * UUID string type.
 */
export type UuidDto = `${string}-${string}-${string}-${string}-${string}`;

/**
 * String to UUID validator.
 */
export const Uuid = z
  .string()
  .uuid()
  .transform((v) => new UUID(v));

/**
 * Create UUID string.
 */
export function createUuidDto(): UuidDto {
  return new UUID().toString() as UuidDto;
}

/**
 * Coercible types schema.
 */
export const CoercibleTypesSchema = z.enum([
  "string",
  "number",
  "boolean",
  "date",
  "uuid",
] as const);
export type CoercibleTypes = z.infer<typeof CoercibleTypesSchema>;

/**
 * Coercible values schema.
 */
export const CoercibleValuesSchema = z.record(z.string(), z.unknown());
export type CoercibleValues = z.infer<typeof CoercibleValuesSchema>;

/**
 * Coercible map schema.
 */
export const CoercibleMapSchema = z.intersection(
  CoercibleValuesSchema,
  z.object({
    $coerce: z.record(z.string(), CoercibleTypesSchema).optional(),
  }),
);
export type CoercibleMap = z.infer<typeof CoercibleMapSchema>;

/**
 * Controller options.
 */
export type ControllerOptions = {
  app: App;
  bindings: AppBindings;
};
