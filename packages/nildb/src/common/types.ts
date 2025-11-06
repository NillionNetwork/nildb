import type { App } from "@nildb/app";
import type { AppBindings } from "@nildb/env";
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

/**
 * Controller options.
 */
export type ControllerOptions = {
  app: App;
  bindings: AppBindings;
};
