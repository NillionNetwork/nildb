import { z } from "zod";
import type { OrganizationAccountDocument } from "#/accounts/accounts.types";
import type { DocumentBase } from "#/common/mongo";
import { type Did, DidSchema } from "#/common/types";
import { LOG_LEVELS } from "#/env";
import { AddQueryRequestSchema } from "#/queries/queries.types";
import { AddSchemaRequestSchema } from "#/schemas/schemas.types";

/**
 * Controllers types
 */
export const AdminCreateAccountRequestSchema = z.object({
  did: DidSchema,
  name: z.string(),
  role: z.enum(["admin", "organization"]),
});
export type AdminCreateAccountRequest = z.infer<
  typeof AdminCreateAccountRequestSchema
>;

export const AdminDeleteAccountRequestSchema = z.object({
  id: DidSchema,
});
export type AdminDeleteAccountRequest = z.infer<
  typeof AdminDeleteAccountRequestSchema
>;

export const AdminAddQueryRequestSchema = AddQueryRequestSchema.extend({
  owner: DidSchema,
});
export type AdminAddQueryRequest = z.infer<typeof AdminAddQueryRequestSchema>;

export const AdminAddSchemaRequestSchema = AddSchemaRequestSchema.extend({
  owner: DidSchema,
});
export type AdminAddSchemaRequest = z.infer<typeof AdminAddSchemaRequestSchema>;

export const AdminSetMaintenanceWindowRequestSchema = z.object({
  start: z.coerce.date(),
  end: z.coerce.date(),
});
export type AdminSetMaintenanceWindowRequest = z.infer<
  typeof AdminSetMaintenanceWindowRequestSchema
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

export const AdminSetLogLevelRequestSchema = z.object({
  level: z.enum(LOG_LEVELS),
});
export type AdminSetLogLevelRequest = z.infer<
  typeof AdminSetLogLevelRequestSchema
>;

export type LogLevelInfo = {
  level: AdminSetLogLevelRequest["level"];
  levelValue: number;
};

/**
 * Repository types
 */
export type AccountDocument =
  | RootAccountDocument
  | AdminAccountDocument
  | OrganizationAccountDocument;

export type RootAccountDocument = {
  _id: Did;
  _role: "root";
};

export type AdminAccountDocument = DocumentBase<Did> & {
  _role: "admin";
  name: string;
};
