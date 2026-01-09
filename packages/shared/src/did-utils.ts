import type { Logger } from "pino";

import { Did } from "@nillion/nuc";

const PUBLIC_KEY_HEX_LENGTH = 66;

/**
 * Normalizes a legacy identifier (hex-encoded public key or `did:nil` string)
 * into the canonical `did:key` format. This function acts as an anti-corruption
 * layer for identifiers entering the domain.
 */
export function normalizeIdentifier(id: string, log: Logger): string {
  if (typeof id !== "string") {
    log.warn({ value: id }, "! normalizeIdentifier received a non-string value.");
    return id;
  }

  if (id.startsWith("did:")) {
    if (id.startsWith("did:nil:")) {
      const publicKeyHex = id.slice("did:nil:".length);
      return Did.serialize(Did.fromPublicKey(publicKeyHex, "key"));
    }
    return id; // Already a valid, non-legacy Did format.
  }

  if (id.length === PUBLIC_KEY_HEX_LENGTH || id.length === 64) {
    try {
      return Did.serialize(Did.fromPublicKey(id, "key"));
    } catch {
      log.warn({ did: id }, "! Failed to convert potential hex key to DID.");
    }
  }

  return id;
}
