import { z } from "zod";
import { type Did, DidSchema, Uuid } from "#/common/types";

export type PermissionsDto = {
  did: Did;
  perms: number; // Bitwise representation of permissions
};

export class Permissions {
  constructor(
    public readonly did: Did,
    public readonly perms: {
      read: boolean;
      write: boolean;
      execute: boolean;
    } = { read: true, write: true, execute: false }, // Default permissions
  ) {}

  toJSON(): PermissionsDto {
    return {
      did: this.did,
      perms:
        Number(this.perms.read) |
        (Number(this.perms.write) << 1) |
        (Number(this.perms.execute) << 2),
    };
  }
}

export const PermissionsSchema = z
  .object({
    did: DidSchema,
    perms: z.number().transform((value) => ({
      read: Boolean(value & 1),
      write: Boolean(value & 2),
      execute: Boolean(value & 4),
    })),
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
