import type pino from "pino";

import { Did } from "@nillion/nuc";

type Logger = pino.Logger;

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
      try {
        return Did.serialize(Did.fromPublicKey(publicKeyHex, "key"));
      } catch {
        // Malformed hex. Callers use the result as a database key, so a bad
        // identifier has to fail the lookup rather than throw out of a mapper.
        log.warn({ did: id }, "! Failed to convert did:nil to did:key.");
        return id;
      }
    }

    // KNOWN GAP: did:ethr identifiers are not canonicalised for case.
    // Ethereum addresses are case-insensitive and @nillion/nuc's Did.areEqual
    // compares them that way, but our database lookups are string equality,
    // so did:ethr:0xAB... and did:ethr:0xab... are one identity to the token
    // validator and two to us. Did.serialize returns the original string, so
    // fixing this means choosing a canonical form (checksummed or lowercase)
    // and migrating every stored identifier: builders.did, users.did,
    // collections.owner, queries.owner, and _owner / _acl.grantee on every
    // data document. The effect today is a failed lookup or a duplicate
    // account, never an authorisation bypass, so it is left for a change that
    // can carry that migration.
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
