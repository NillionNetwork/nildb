import { UUID } from "mongodb";
import { z } from "zod";

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
