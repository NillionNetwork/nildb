import { PaymentValidationError } from "@nildb/common/errors";
import type { AppBindings } from "@nildb/env";
import { Effect as E } from "effect";

import { getChainConfig, type ChainConfig, type PaymentPayload, validatePayment } from "@nillion/nilpay-client";

import type { RegisterCreditsCommand } from "./credits.types.js";

/**
 * Get chain configuration from environment.
 */
export function getChainConfigFromEnv(ctx: AppBindings, chainId: number): ChainConfig | null {
  const { config } = ctx;

  if (!config.ethereumRpcUrls) {
    return null;
  }

  // Parse chain RPC URLs (format: "chainId:url,chainId:url,...")
  const entries = config.ethereumRpcUrls.split(",").map((e) => e.trim());
  for (const entry of entries) {
    const colonIndex = entry.indexOf(":");
    if (colonIndex === -1) continue;

    const idStr = entry.slice(0, colonIndex);
    const url = entry.slice(colonIndex + 1);
    const id = Number.parseInt(idStr, 10);

    if (id === chainId) {
      return getChainConfig(chainId, url);
    }
  }

  return null;
}

/**
 * Validate a payment on-chain.
 * This is the full validation that checks the Ethereum blockchain.
 */
export function validatePaymentOnChain(
  ctx: AppBindings,
  txHash: `0x${string}`,
  command: RegisterCreditsCommand,
): E.Effect<{ amountUnils: bigint; payer: `0x${string}` }, PaymentValidationError> {
  const { log } = ctx;

  return E.tryPromise({
    try: async () => {
      // Get chain config
      const chainConfig = getChainConfigFromEnv(ctx, command.chainId);
      if (!chainConfig) {
        throw new Error(`Chain ${command.chainId} is not configured`);
      }

      // Build payload for validation
      const payload: PaymentPayload = {
        nodePublicKey: command.nodePublicKey,
        payerDid: command.payerDid,
        amountUnils: command.amountUnils,
        nonce: command.nonce,
        timestamp: command.timestamp,
        chainId: command.chainId,
      };

      // Validate on chain
      const result = await validatePayment(chainConfig, txHash, payload);

      if (!result.valid) {
        throw new Error(result.reason);
      }

      log.info(
        "Payment validated on chain %d: tx=%s, payer=%s, amount=%s unils",
        command.chainId,
        txHash,
        result.payer,
        result.amountUnils.toString(),
      );

      return {
        amountUnils: result.amountUnils,
        payer: result.payer,
      };
    },
    catch: (error) => {
      const message = error instanceof Error ? error.message : String(error);
      log.error("Payment validation failed: %s", message);
      return new PaymentValidationError({ message });
    },
  });
}

/**
 * Verify that a DID resolves to an Ethereum address.
 * This is used to verify that the payer_did in the payment matches the on-chain payer.
 */
export function verifyDidMatchesPayer(payerDid: string, payerAddress: `0x${string}`): boolean {
  // did:ethr addresses contain the Ethereum address
  // Format: did:ethr:0x1234...
  if (payerDid.startsWith("did:ethr:")) {
    const address = payerDid.slice("did:ethr:".length).toLowerCase();
    return address === payerAddress.toLowerCase();
  }

  // For did:key, we'd need to derive the address from the public key
  // This is more complex and requires additional libraries
  // For now, we'll just return false for did:key
  return false;
}
