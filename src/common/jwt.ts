import type { Keypair } from "@nillion/nuc-ts";
import * as didJwt from "did-jwt";

export function createJwt(
  payload: Partial<didJwt.JWTPayload>,
  keypair: Keypair,
): Promise<string> {
  const signer = didJwt.ES256KSigner(keypair.privateKey());
  return didJwt.createJWT(payload, {
    signer,
    issuer: keypair.toDidString(),
    // 10 minutes
    expiresIn: 1000 * 60 * 10,
  });
}
