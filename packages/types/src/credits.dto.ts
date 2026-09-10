import { z } from "zod";

import { PaginatedResponse } from "./pagination.dto";
import { ApiSuccessResponse } from "./responses.dto";

/**
 * Builder status for credit-based access control.
 */
export const BuilderStatusDto = z.enum(["free_tier", "active", "warning", "read_only", "suspended", "pending_purge"]);
export type BuilderStatusDto = z.infer<typeof BuilderStatusDto>;

/**
 * Payment payload that gets hashed into the digest.
 */
export const PaymentPayloadDto = z
  .object({
    nodePublicKey: z.string(),
    payerDid: z.string(),
    amountUnils: z.string(), // bigint as string
    nonce: z.string(),
    timestamp: z.number().int().positive(),
    chainId: z.number().int().positive(),
  })
  .meta({ ref: "PaymentPayloadDto" });
export type PaymentPayloadDto = z.infer<typeof PaymentPayloadDto>;

/**
 * Request to register credits from a payment transaction.
 */
export const RegisterCreditsRequest = z
  .object({
    txHash: z.string().regex(/^0x[a-fA-F0-9]{64}$/),
    chainId: z.number().int().positive(),
    payload: PaymentPayloadDto,
  })
  .meta({ ref: "RegisterCreditsRequest" });
export type RegisterCreditsRequest = z.infer<typeof RegisterCreditsRequest>;

/**
 * Response after registering credits.
 */
const RegisterCreditsData = z.object({
  creditsUsd: z.number(),
  status: BuilderStatusDto,
});
export const RegisterCreditsResponse = ApiSuccessResponse(RegisterCreditsData).meta({
  ref: "RegisterCreditsResponse",
});
export type RegisterCreditsResponse = z.infer<typeof RegisterCreditsResponse>;

/**
 * Response for reading credit balance.
 */
const ReadCreditsData = z.object({
  creditsUsd: z.number(),
  status: BuilderStatusDto,
  storageBytes: z.number().int().nonnegative(),
  estimatedHoursRemaining: z.number().nonnegative().nullable(),
});
export const ReadCreditsResponse = ApiSuccessResponse(ReadCreditsData).meta({
  ref: "ReadCreditsResponse",
});
export type ReadCreditsResponse = z.infer<typeof ReadCreditsResponse>;

/**
 * Contract addresses for a supported chain.
 */
export const ChainContractInfoDto = z.object({
  chainId: z.number().int().positive(),
  nilTokenAddress: z.string(),
  burnContractAddress: z.string(),
});
export type ChainContractInfoDto = z.infer<typeof ChainContractInfoDto>;

/**
 * Response for reading pricing information.
 */
const ReadPricingData = z.object({
  storageCostPerGbHour: z.number().positive(),
  freeTierBytes: z.number().int().nonnegative(),
  supportedChainIds: z.array(z.number().int().positive()),
  nilUsdPrice: z.number().positive().nullable(),
  chains: z.array(ChainContractInfoDto),
});
export const ReadPricingResponse = ApiSuccessResponse(ReadPricingData).meta({
  ref: "ReadPricingResponse",
});
export type ReadPricingResponse = z.infer<typeof ReadPricingResponse>;

/**
 * A single payment history item.
 */
const PaymentHistoryItemDto = z.object({
  txHash: z.string(),
  chainId: z.number().int().positive(),
  amountUnils: z.string(),
  amountUsd: z.number(),
  processedAt: z.string(), // ISO 8601
});

/**
 * Response for reading payment history.
 */
export const ReadPaymentsResponse = PaginatedResponse(PaymentHistoryItemDto).meta({
  ref: "ReadPaymentsResponse",
});
export type ReadPaymentsResponse = z.infer<typeof ReadPaymentsResponse>;

/**
 * A keccak256 token hash, as produced by the revocation helpers.
 */
export const TokenHash = z.string().regex(/^0x[0-9a-f]{64}$/);
export type TokenHash = z.infer<typeof TokenHash>;

/**
 * Request to revoke a token.
 *
 * The serialised token is required rather than a bare hash: the node has to
 * verify the signature and check that the caller is its issuer or audience
 * before recording a revocation, and it derives the hash itself.
 */
export const RevokeTokenRequest = z
  .object({
    token: z.string().min(1).max(8192),
  })
  .meta({ ref: "RevokeTokenRequest" });
export type RevokeTokenRequest = z.infer<typeof RevokeTokenRequest>;

/**
 * Response after revoking a token.
 */
export const RevokeTokenResponse = z.string();
export type RevokeTokenResponse = z.infer<typeof RevokeTokenResponse>;

/**
 * Request to lookup token revocations.
 */
export const LookupRevocationsRequest = z
  .object({
    tokenHashes: z.array(TokenHash).min(1).max(64),
  })
  .meta({ ref: "LookupRevocationsRequest" });
export type LookupRevocationsRequest = z.infer<typeof LookupRevocationsRequest>;

/**
 * Response for revocation lookup.
 */
const LookupRevocationsData = z.object({
  revoked: z.array(z.string()),
});
export const LookupRevocationsResponse = ApiSuccessResponse(LookupRevocationsData).meta({
  ref: "LookupRevocationsResponse",
});
export type LookupRevocationsResponse = z.infer<typeof LookupRevocationsResponse>;
