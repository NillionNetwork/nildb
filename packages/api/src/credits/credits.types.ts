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
  /** The builder whose balance this payment credited. Absent on legacy rows. */
  builderDid?: string;
  /**
   * False between inserting the payment and the balance update landing.
   * Lets a retry finish a payment that would otherwise be marked processed
   * forever without the builder ever receiving the credits.
   */
  creditsApplied?: boolean;
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
  builderDid: string;
  amountUnils: bigint;
  nonce: string;
  timestamp: number;
};

/**
 * Admin credit grant document - records an admin-initiated credit top-up.
 */
export type AdminCreditGrantDocument = {
  _id: ObjectId;
  _created: Date;
  builderDid: string;
  adminDid: string;
  amountUsd: number;
  reason?: string;
};

/**
 * Command to add a revocation.
 */
export type AddRevocationCommand = {
  tokenHash: string;
  revokedBy: string;
  expiresAt: Date;
};
