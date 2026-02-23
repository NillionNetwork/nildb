import { keccak256 } from "viem";

import type { Envelope } from "@nillion/nuc";

/**
 * Hash a NUC token for revocation lookup.
 * Uses keccak256 of the token's signature.
 */
export function hashToken(envelope: Envelope): string {
  // Use the token's signature as the basis for the hash
  const sigBytes = envelope.nuc.signature;
  return keccak256(sigBytes);
}

/**
 * Hash a single token from the proof chain by its index.
 */
export function hashTokenAtIndex(envelope: Envelope, index: number): string {
  if (index === 0) {
    // Hash the main NUC's signature
    return keccak256(envelope.nuc.signature);
  }

  // Hash a proof token's signature
  const proofIndex = index - 1;
  if (proofIndex >= envelope.proofs.length) {
    throw new Error(`Invalid proof index: ${proofIndex}`);
  }

  return keccak256(envelope.proofs[proofIndex].signature);
}

/**
 * Get all token hashes in a proof chain.
 * Returns hashes in order: [main_token, proof_0, proof_1, ...]
 */
export function getProofChainHashes(envelope: Envelope): string[] {
  const hashes: string[] = [];

  // Hash the main token
  hashes.push(hashTokenAtIndex(envelope, 0));

  // Hash each proof
  for (let i = 0; i < envelope.proofs.length; i++) {
    hashes.push(hashTokenAtIndex(envelope, i + 1));
  }

  return hashes;
}
