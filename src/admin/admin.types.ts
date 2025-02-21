import { z } from "zod";
import type { OrganizationAccountDocument } from "#/accounts/accounts.types";
import { NilDid } from "#/common/nil-did";
import { PUBLIC_KEY_LENGTH } from "#/env";
import { AddQueryRequestSchema } from "#/queries/queries.types";
import { AddSchemaRequestSchema } from "#/schemas/schemas.types";

/**
 * Controllers types
 */
export const AdminCreateAccountRequestSchema = z.object({
  did: NilDid,
  publicKey: z.string().length(PUBLIC_KEY_LENGTH),
  name: z.string(),
  type: z.enum(["admin", "organization"]),
});
export type AdminCreateAccountRequest = z.infer<
  typeof AdminCreateAccountRequestSchema
>;

export const AdminDeleteAccountRequestSchema = z.object({
  id: NilDid,
});
export type AdminDeleteAccountRequest = z.infer<
  typeof AdminDeleteAccountRequestSchema
>;

export const AdminSetSubscriptionStateRequestSchema = z.object({
  ids: z.array(NilDid).nonempty(),
  active: z.boolean(),
});
export type AdminSetSubscriptionStateRequest = z.infer<
  typeof AdminSetSubscriptionStateRequestSchema
>;

export const AdminAddQueryRequestSchema = AddQueryRequestSchema.extend({
  owner: NilDid,
});
export type AdminAddQueryRequest = z.infer<typeof AdminAddQueryRequestSchema>;

export const AdminAddSchemaRequestSchema = AddSchemaRequestSchema.extend({
  owner: NilDid,
});
export type AdminAddSchemaRequest = z.infer<typeof AdminAddSchemaRequestSchema>;

export const AdminSetMaintenanceWindowRequestSchema = z.object({
  did: NilDid,
  start: z.coerce.date(),
  end: z.coerce.date(),
});
export type AdminSetMaintenanceWindowRequest = z.infer<
  typeof AdminSetMaintenanceWindowRequestSchema
>;

export const AdminDeleteMaintenanceWindowRequestSchema = z.object({
  did: NilDid,
});
export type AdminDeleteMaintenanceWindowRequest = z.infer<
  typeof AdminDeleteMaintenanceWindowRequestSchema
>;

export const CreateSchemaIndexRequestSchema = z.object({
  name: z.string().min(4),
  keys: z.array(
    z
      .record(z.string(), z.union([z.literal(1), z.literal(-1)]))
      .refine(
        (obj) => Object.keys(obj).length === 1,
        "Each object must have exactly one key: [{ _id: 1 }, { foo: -1 }]",
      ),
  ),
  unique: z.boolean(),
  ttl: z.number().optional(),
});

export type CreateSchemaIndexRequest = z.infer<
  typeof CreateSchemaIndexRequestSchema
>;
/**
 * Repository types
 */
export type AccountDocument =
  | RootAccountDocument
  | AdminAccountDocument
  | OrganizationAccountDocument;

export type AccountType = "root" | "admin" | "organization";

export type RootAccountDocument = {
  _id: NilDid;
  _type: "root";
  publicKey: string;
};

export type AdminAccountDocument = {
  _id: NilDid;
  _type: "admin";
  _created: Date;
  _updated: Date;
  publicKey: string;
  name: string;
};
