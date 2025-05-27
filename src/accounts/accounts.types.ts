import type { UUID } from "mongodb";
import { z } from "zod";
import type { ApiResponse } from "#/common/handler";
import type { DocumentBase } from "#/common/mongo";
import { type Did, DidSchema } from "#/common/types";
import { PUBLIC_KEY_LENGTH } from "#/env";

/**
 * Controller types
 */
export type GetAccountResponse = ApiResponse<OrganizationAccountDocument>;

export const SetPublicKeyRequestSchema = z.object({
  did: DidSchema,
  publicKey: z.string().length(PUBLIC_KEY_LENGTH),
});
export type SetPublicKeyRequest = z.infer<typeof SetPublicKeyRequestSchema>;
export type SetPublicKeyResponse = ApiResponse<Did>;

export const RegisterAccountRequestSchema = z.object({
  did: DidSchema,
  name: z.string(),
});
export type RegisterAccountRequest = z.infer<
  typeof RegisterAccountRequestSchema
>;
export type RegisterAccountResponse = ApiResponse<Did>;

export const RemoveAccountRequestSchema = z.object({
  id: DidSchema,
});
export type RemoveAccountRequest = z.infer<typeof RemoveAccountRequestSchema>;
export type RemoveAccountResponse = ApiResponse<string>;

/**
 * Repository types
 */
export type OrganizationAccountDocument = DocumentBase<Did> & {
  _role: "organization";
  name: string;
  schemas: UUID[];
  queries: UUID[];
};
