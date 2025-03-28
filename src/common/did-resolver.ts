import type {
  DIDDocument,
  DIDResolutionOptions,
  DIDResolutionResult,
  Resolvable,
} from "did-resolver";
import { Effect as E, pipe } from "effect";
import * as AccountsRepository from "#/accounts/accounts.repository";
import { type Did, DidSchema } from "#/common/types";
import type { AppBindings } from "#/env";

export function buildNilMethodResolver(bindings: AppBindings): Resolvable {
  const resolve = async (
    did: string,
    _options?: DIDResolutionOptions,
  ): Promise<DIDResolutionResult> => {
    return pipe(
      E.try(() => DidSchema.parse(did)),
      E.flatMap((did) => findDocument(bindings, did)),
      E.runPromise,
    );
  };

  return { resolve };
}

function findDocument(
  ctx: AppBindings,
  did: Did,
): E.Effect<DIDResolutionResult> {
  return pipe(
    AccountsRepository.findByIdWithCache(ctx, did),
    E.map((_account) => ({
      didResolutionMetadata: {
        contentType: "application/did+json",
      },
      didDocument: createDocument(did),
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

function createDocument(did: Did): DIDDocument {
  const publicKeyHex = did.split(":")[2];
  return {
    id: did.toString(),
    verificationMethod: [
      {
        id: "#secp256k1",
        type: "EcdsaSecp256k1VerificationKey2019",
        controller: did.toString(),
        publicKeyHex,
      },
    ],
    authentication: ["#secp256k1"],
  };
}
