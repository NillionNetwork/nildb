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

const DID_EXPRESSION = /^did:nil:([a-zA-Z0-9]{66})$/;

/**
 * Decentralized identifier type.
 */
export type Did = `did:nil:${string}`;

/**
 * DID validator.
 */
export const Did = z
  .string()
  .regex(DID_EXPRESSION)
  .transform((v) => v as Did)
  .openapi({
    description:
      "A decentralised identifier: `did:nil:<secp256k1_pub_key_as_hex>`",
    example:
      "did:nil:037a87f9b010687e23eccb2fc70a474cbb612418cb513a62289eaed6cf1f11ac6b",
    type: "string",
  });

/**
 * Controller options.
 */
export type ControllerOptions = {
  app: App;
  bindings: AppBindings;
};
