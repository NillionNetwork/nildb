import { z } from "zod";
import { type Did, DidSchema, Uuid } from "#/common/types";

export class Permissions {
  constructor(
    public readonly did: Did,
    public readonly perms: {
      read: boolean;
      write: boolean;
      execute: boolean;
    } = { read: false, write: false, execute: false }, // Default permissions
  ) {}
}

export const PermissionsSchema = z
  .object({
    did: DidSchema,
    perms: z.object({
      read: z.boolean().default(false),
      write: z.boolean().default(false),
      execute: z.boolean().default(false),
    }),
  })
  .transform(({ did, perms }) => new Permissions(did, perms));
/**
 *
 * Controller types
 */
export const UserDataRequestSchema = z.object({
  userId: DidSchema,
});
export type UserDataRequest = z.infer<typeof UserDataRequestSchema>;

export const ReadPermissionsRequestSchema = z.object({
  schema: Uuid,
  documentId: Uuid,
});
export type ReadPermissionsRequest = z.infer<
  typeof ReadPermissionsRequestSchema
>;

export const AddPermissionsRequestSchema = z.object({
  schema: Uuid,
  documentId: Uuid,
  permissions: PermissionsSchema,
});
export type AddPermissionsRequest = z.infer<typeof AddPermissionsRequestSchema>;

export const UpdatePermissionsRequestSchema = z.object({
  schema: Uuid,
  documentId: Uuid,
  permissions: PermissionsSchema,
});
export type UpdatePermissionsRequest = z.infer<
  typeof UpdatePermissionsRequestSchema
>;

export const DeletePermissionsRequestSchema = z.object({
  schema: Uuid,
  documentId: Uuid,
  did: DidSchema,
});
export type DeletePermissionsRequest = z.infer<
  typeof DeletePermissionsRequestSchema
>;
