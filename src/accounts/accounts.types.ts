import type { UUID } from "mongodb";
import { z } from "zod";
import type { ApiResponse } from "#/common/handler";
import { NilDid } from "#/common/nil-did";
import { PUBLIC_KEY_LENGTH } from "#/env";

/**
 * Controller types
 */
export type GetAccountResponse = ApiResponse<OrganizationAccountDocument>;

export const SetPublicKeyRequestSchema = z.object({
  did: NilDid,
  publicKey: z.string().length(PUBLIC_KEY_LENGTH),
});
export type SetPublicKeyRequest = z.infer<typeof SetPublicKeyRequestSchema>;
export type SetPublicKeyResponse = ApiResponse<NilDid>;

export const RegisterAccountRequestSchema = z.object({
  did: NilDid,
  publicKey: z.string().length(PUBLIC_KEY_LENGTH),
  name: z.string(),
});
export type RegisterAccountRequest = z.infer<
  typeof RegisterAccountRequestSchema
>;
export type RegisterAccountResponse = ApiResponse<NilDid>;

export const RemoveAccountRequestSchema = z.object({
  id: NilDid,
});
export type RemoveAccountRequest = z.infer<typeof RemoveAccountRequestSchema>;
export type RemoveAccountResponse = ApiResponse<string>;

/**
 * Repository types
 */
export type OrganizationAccountDocument = {
  _id: NilDid;
  _type: "organization";
  _created: Date;
  _updated: Date;
  publicKey: string;
  name: string;
  subscription: {
    active: boolean;
  };
  schemas: UUID[];
  queries: UUID[];
};
