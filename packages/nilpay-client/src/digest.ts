import { keccak256, encodeAbiParameters } from "viem";

import type { PaymentPayload } from "./types";

/**
 * Compute the canonical digest for a payment payload.
 * This digest is committed on-chain when burning tokens.
 *
 * The digest is computed as:
 *   keccak256(abi.encode(nodePublicKey, payerDid, builderDid, amountUnils, nonce, timestamp, chainId))
 *
 * builderDid is part of the commitment so that only the named builder can
 * redeem the burn. Without it, whoever submits the payload first receives the
 * credits.
 */
export function computeDigest(payload: PaymentPayload): `0x${string}` {
  const encoded = encodeAbiParameters(
    [
      { type: "string", name: "nodePublicKey" },
      { type: "string", name: "payerDid" },
      { type: "string", name: "builderDid" },
      { type: "uint256", name: "amountUnils" },
      { type: "string", name: "nonce" },
      { type: "uint256", name: "timestamp" },
      { type: "uint256", name: "chainId" },
    ],
    [
      payload.nodePublicKey,
      payload.payerDid,
      payload.builderDid,
      payload.amountUnils,
      payload.nonce,
      BigInt(payload.timestamp),
      BigInt(payload.chainId),
    ],
  );

  return keccak256(encoded);
}

/**
 * Serialize a payment payload to a canonical JSON string.
 * Used for display and verification purposes.
 */
export function serializePayload(payload: PaymentPayload): string {
  return JSON.stringify({
    nodePublicKey: payload.nodePublicKey,
    payerDid: payload.payerDid,
    builderDid: payload.builderDid,
    amountUnils: payload.amountUnils.toString(),
    nonce: payload.nonce,
    timestamp: payload.timestamp,
    chainId: payload.chainId,
  });
}

/**
 * Deserialize a payment payload from canonical JSON string.
 */
export function deserializePayload(json: string): PaymentPayload {
  const parsed = JSON.parse(json) as {
    nodePublicKey: string;
    payerDid: string;
    builderDid: string;
    amountUnils: string;
    nonce: string;
    timestamp: number;
    chainId: number;
  };

  return {
    nodePublicKey: parsed.nodePublicKey,
    payerDid: parsed.payerDid,
    builderDid: parsed.builderDid,
    amountUnils: BigInt(parsed.amountUnils),
    nonce: parsed.nonce,
    timestamp: parsed.timestamp,
    chainId: parsed.chainId,
  };
}
