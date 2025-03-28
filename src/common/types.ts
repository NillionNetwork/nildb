import { UUID } from "mongodb";
import { z } from "zod";

// From node:crypto but re-exported here to avoid collisions with mongodb's UUID class
export type UuidDto = `${string}-${string}-${string}-${string}-${string}`;

export const Uuid = z
  .string()
  .uuid()
  .transform((val) => new UUID(val));

export function createUuidDto(): UuidDto {
  return new UUID().toString() as UuidDto;
}

export const CoercibleTypesSchema = z.enum(["date", "uuid"] as const);
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
export const DidSchema = z
  .string()
  .regex(DID_EXPRESSION)
  .transform((d) => d as Did);
