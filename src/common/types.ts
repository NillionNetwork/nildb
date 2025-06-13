import { UUID } from "mongodb";
import { z } from "zod";
import type { App } from "#/app";
import type { AppBindings } from "#/env";

// From node:crypto but re-exported here to avoid collisions with mongodb's UUID class
export type UuidDto = `${string}-${string}-${string}-${string}-${string}`;

export const Uuid = z
  .string()
  .uuid()
  .transform((v) => new UUID(v));

export function createUuidDto(): UuidDto {
  return new UUID().toString() as UuidDto;
}

export const CoercibleTypesSchema = z.enum([
  "string",
  "number",
  "boolean",
  "date",
  "uuid",
] as const);
export type CoercibleTypes = z.infer<typeof CoercibleTypesSchema>;

export const CoercibleValuesSchema = z.record(z.string(), z.unknown());
export type CoercibleValues = z.infer<typeof CoercibleValuesSchema>;

export const CoercibleMapSchema = z.intersection(
  CoercibleValuesSchema,
  z.object({
    $coerce: z.record(z.string(), CoercibleTypesSchema).optional(),
  }),
);
export type CoercibleMap = z.infer<typeof CoercibleMapSchema>;

const DID_EXPRESSION = /^did:nil:([a-zA-Z0-9]{66})$/;

export type Did = `did:nil:${string}`;

export const Did = z.string().regex(DID_EXPRESSION).openapi({
  description:
    "A decentralised identifier: `did:nil:<secp256k1_pub_key_as_hex>`",
  example:
    "did:nil:037a87f9b010687e23eccb2fc70a474cbb612418cb513a62289eaed6cf1f11ac6b",
  type: "string",
});

export type ControllerOptions = {
  app: App;
  bindings: AppBindings;
};
