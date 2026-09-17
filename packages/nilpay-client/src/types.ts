/**
 * Chain configuration for payment validation.
 */
export type ChainConfig = {
  chainId: number;
  name: string;
  rpcUrl: string;
  nilTokenAddress: `0x${string}`;
  burnContractAddress: `0x${string}`;
};

/**
 * Payment payload that gets hashed into the digest.
 * This is what the user commits to when burning NIL tokens.
 */
export type PaymentPayload = {
  nodePublicKey: string;
  payerDid: string;
  /** The builder account the burn credits. Bound into the digest so the
   *  commitment cannot be redeemed by a different account. */
  builderDid: string;
  amountUnils: bigint;
  nonce: string;
  timestamp: number;
  chainId: number;
};

/**
 * LogBurnWithDigest event data parsed from the blockchain.
 */
export type BurnEvent = {
  payer: `0x${string}`;
  amount: bigint;
  digest: `0x${string}`;
  /** Contract-supplied burn time, in unix seconds. */
  timestamp: bigint;
  blockNumber: bigint;
  transactionHash: `0x${string}`;
};

/**
 * Result of validating a payment.
 */
export type PaymentValidationResult =
  | { valid: true; amountUnils: bigint; payer: `0x${string}`; burnTimestamp: bigint }
  | { valid: false; reason: string };

/**
 * NIL/USD exchange rate result.
 */
export type ExchangeRate = {
  nilUsdPrice: number;
  timestamp: number;
};
