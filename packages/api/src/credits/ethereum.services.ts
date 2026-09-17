import { PaymentValidationError } from "@nildb/common/errors";
import type { AppBindings } from "@nildb/env";
import { parseEthereumChains } from "@nildb/env";
import { Effect as E } from "effect";

import { getChainConfig, type ChainConfig, type PaymentPayload, validatePayment } from "@nillion/nilpay-client";

import type { RegisterCreditsCommand } from "./credits.types";

export function toSafeRpcErrorName(error: unknown): string {
  if (!(error instanceof Error)) return "UnknownError";
  return /^[A-Za-z][A-Za-z0-9_.-]{0,63}$/.test(error.name) ? error.name : "Error";
}

/**
 * A payment the chain answered about, and the answer was "no".
 *
 * Distinguished from a transport failure so that only these reasons are safe
 * to hand back to the caller. viem embeds the full request URL in its
 * transport errors, and the RPC URL usually carries the provider api key.
 */
class PaymentRejected extends Error {}

/**
 * Get chain configuration from environment.
 */
export function getChainConfigFromEnv(ctx: AppBindings, chainId: number): ChainConfig | null {
  const chains = parseEthereumChains(ctx.config.ethereumRpcUrls);
  const rpcUrl = chains.get(chainId);
  if (!rpcUrl) return null;
  return getChainConfig(chainId, rpcUrl);
}

/**
 * Validate a payment on-chain.
 * This is the full validation that checks the Ethereum blockchain.
 */
export function validatePaymentOnChain(
  ctx: AppBindings,
  txHash: `0x${string}`,
  command: RegisterCreditsCommand,
): E.Effect<{ amountUnils: bigint; payer: `0x${string}`; burnTimestamp: bigint }, PaymentValidationError> {
  const { log } = ctx;

  return E.tryPromise({
    try: async () => {
      // Get chain config
      const chainConfig = getChainConfigFromEnv(ctx, command.chainId);
      if (!chainConfig) {
        throw new PaymentRejected(`Chain ${command.chainId} is not configured`);
      }

      // Build payload for validation
      const payload: PaymentPayload = {
        nodePublicKey: command.nodePublicKey,
        payerDid: command.payerDid,
        builderDid: command.builderDid,
        amountUnils: command.amountUnils,
        nonce: command.nonce,
        timestamp: command.timestamp,
        chainId: command.chainId,
      };

      // Validate on chain
      const result = await validatePayment(chainConfig, txHash, payload);

      if (!result.valid) {
        throw new PaymentRejected(result.reason);
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
        burnTimestamp: result.burnTimestamp,
      };
    },
    catch: (error) => {
      if (error instanceof PaymentRejected) {
        return new PaymentValidationError({ message: error.message });
      }

      // viem transport messages include the complete RPC URL, which commonly
      // contains provider credentials. Keep both logs and telemetry to a safe
      // error class rather than forwarding the message or cause.
      log.error(
        { errorType: toSafeRpcErrorName(error), chainId: command.chainId },
        "Payment validation failed talking to the chain",
      );
      return new PaymentValidationError({
        message: "Unable to verify the payment on chain, please retry",
      });
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
