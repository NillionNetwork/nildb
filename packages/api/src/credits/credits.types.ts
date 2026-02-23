import type { ObjectId } from "mongodb";

/**
 * Payment document - records a processed payment transaction.
 */
export type PaymentDocument = {
  _id: ObjectId;
  _created: Date;
  _updated: Date;
  txHash: string;
  chainId: number;
  payerDid: string;
  amountUnils: string; // bigint as string for MongoDB
  amountUsd: number;
  digest: string;
  nodePublicKey: string;
  processedAt: Date;
};

/**
 * Revocation document - records a revoked token.
 */
export type RevocationDocument = {
  _id: ObjectId;
  _created: Date;
  tokenHash: string;
  revokedBy: string;
  expiresAt: Date;
};

/**
 * Command to register credits from a payment.
 */
export type RegisterCreditsCommand = {
  txHash: string;
  chainId: number;
  nodePublicKey: string;
  payerDid: string;
  amountUnils: bigint;
  nonce: string;
  timestamp: number;
};

/**
 * Command to add a revocation.
 */
export type AddRevocationCommand = {
  tokenHash: string;
  revokedBy: string;
  expiresAt: Date;
};
