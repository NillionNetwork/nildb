import type {
  DIDDocument,
  DIDResolutionOptions,
  DIDResolutionResult,
  Resolvable,
} from "did-resolver";
import { Effect as E, pipe } from "effect";
import { z } from "zod";
import * as AccountsRepository from "#/accounts/accounts.repository";
import type { AppBindings } from "#/env";

export const NilDidRegex = /^did:nil:nillion1[a-z0-9]{38}$/;
export const NilDidSchema = z.custom<NilDid>((data) => NilDidRegex.test(data), {
  message: "Invalid NilDid format. Must match did:nil:nillion1[38 chars]",
});
export type NilChainAddress = `nillion1${string}`;
export type NilDid = `did:nil:${NilChainAddress}`;

export function buildNilMethodResolver(bindings: AppBindings): Resolvable {
  const resolve = async (
    did: string,
    _options?: DIDResolutionOptions,
  ): Promise<DIDResolutionResult> => {
    // only supports application/did+json
    return pipe(findDocument(bindings, did as NilDid), E.runPromise);
  };

  return { resolve };
}

function findDocument(
  ctx: AppBindings,
  did: NilDid,
): E.Effect<DIDResolutionResult> {
  return pipe(
    AccountsRepository.findByIdWithCache(ctx, did),
    E.map((account) => ({
      didResolutionMetadata: {
        contentType: "application/did+json",
      },
      didDocument: createDocument(did, account.publicKey),
      didDocumentMetadata: {},
    })),
    E.catchAll((_e) =>
      E.succeed({
        didResolutionMetadata: {
          error: "notFound",
        },
        didDocument: null,
        didDocumentMetadata: {},
      }),
    ),
  );
}

function createDocument(did: string, publicKeyHex: string): DIDDocument {
  return {
    id: did,
    verificationMethod: [
      {
        id: "#secp256k1",
        type: "EcdsaSecp256k1VerificationKey2019",
        controller: did,
        publicKeyHex,
      },
    ],
    authentication: ["#secp256k1"],
  };
}
