import type { UUID } from "mongodb";
import { z } from "zod";
import type { ApiResponse } from "#/common/handler";
import { type NilDid, NilDidSchema } from "#/common/nil-did";
import { PUBLIC_KEY_LENGTH } from "#/env";

/**
 * Controller types
 */
export type GetAccountResponse = ApiResponse<OrganizationAccountDocument>;

export const SetPublicKeyRequestSchema = z.object({
  did: NilDidSchema,
  publicKey: z.string().length(PUBLIC_KEY_LENGTH),
});
export type SetPublicKeyRequest = z.infer<typeof SetPublicKeyRequestSchema>;
export type SetPublicKeyResponse = ApiResponse<NilDid>;

export const RegisterAccountRequestSchema = z.object({
  did: NilDidSchema,
  publicKey: z.string().length(PUBLIC_KEY_LENGTH),
  name: z.string(),
});
export type RegisterAccountRequest = z.infer<
  typeof RegisterAccountRequestSchema
>;
export type RegisterAccountResponse = ApiResponse<NilDid>;

export const RemoveAccountRequestSchema = z.object({
  id: NilDidSchema,
});
export type RemoveAccountRequest = z.infer<typeof RemoveAccountRequestSchema>;
export type RemoveAccountResponse = ApiResponse<string>;

export type AccountSubscriptionDocument = {
  active: boolean;
  start: Date;
  end: Date;
  txHash: string;
};

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
    start: Date;
    end: Date;
    txHash: string;
  };
  schemas: UUID[];
  queries: UUID[];
};
