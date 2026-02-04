import { createPublicClient, http } from "viem";

import { computeDigest } from "./digest.js";
import type { BurnEvent, ChainConfig, PaymentPayload, PaymentValidationResult } from "./types.js";

/**
 * Fetch the LogBurnWithDigest event from a transaction.
 *
 * @param rpcUrl - RPC URL for the chain
 * @param burnContractAddress - Address of the burn contract
 * @param txHash - Transaction hash to look up
 * @returns The burn event if found, null otherwise
 */
export async function getBurnEvent(
  rpcUrl: string,
  burnContractAddress: `0x${string}`,
  txHash: `0x${string}`,
): Promise<BurnEvent | null> {
  const client = createPublicClient({
    transport: http(rpcUrl),
  });

  const receipt = await client.getTransactionReceipt({ hash: txHash });

  // Find the LogBurnWithDigest event in the logs
  for (const log of receipt.logs) {
    if (log.address.toLowerCase() !== burnContractAddress.toLowerCase()) {
      continue;
    }

    // Check if this is a LogBurnWithDigest event
    // The event has indexed payer and digest, so we check for 3 topics
    if (log.topics[0] && log.topics.length >= 3) {
      // Decode the event
      // topics[1] = payer (indexed)
      // topics[2] = digest (indexed)
      // data = amount

      const payer = `0x${log.topics[1]?.slice(-40)}` as `0x${string}`;
      const digest = log.topics[2] as `0x${string}`;
      const amount = BigInt(log.data);

      return {
        payer,
        amount,
        digest,
        blockNumber: receipt.blockNumber,
        transactionHash: txHash,
      };
    }
  }

  return null;
}

/**
 * Validate a payment by checking the on-chain burn event.
 *
 * @param chain - Chain configuration
 * @param txHash - Transaction hash of the burn
 * @param payload - Expected payment payload
 * @returns Validation result
 */
export async function validatePayment(
  chain: ChainConfig,
  txHash: `0x${string}`,
  payload: PaymentPayload,
): Promise<PaymentValidationResult> {
  // Verify chain ID matches
  if (payload.chainId !== chain.chainId) {
    return {
      valid: false,
      reason: `Chain ID mismatch: payload has ${payload.chainId}, validating on ${chain.chainId}`,
    };
  }

  // Fetch the burn event
  const burnEvent = await getBurnEvent(chain.rpcUrl, chain.burnContractAddress, txHash);

  if (!burnEvent) {
    return {
      valid: false,
      reason: "No LogBurnWithDigest event found in transaction",
    };
  }

  // Compute expected digest
  const expectedDigest = computeDigest(payload);

  // Verify digest matches
  if (burnEvent.digest.toLowerCase() !== expectedDigest.toLowerCase()) {
    return {
      valid: false,
      reason: "Digest mismatch: on-chain digest does not match computed payload digest",
    };
  }

  // Verify amount matches
  if (burnEvent.amount < payload.amountUnils) {
    return {
      valid: false,
      reason: `Insufficient burn amount: burned ${burnEvent.amount} unils, expected at least ${payload.amountUnils}`,
    };
  }

  return {
    valid: true,
    amountUnils: burnEvent.amount,
    payer: burnEvent.payer,
  };
}
