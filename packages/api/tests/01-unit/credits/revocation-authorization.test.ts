import { mayRevokeToken } from "@nildb/credits/revocations.controllers";
import { describe, expect, it } from "vitest";

import { type Did, Signer } from "@nillion/nuc";

async function didFor(privateKey: string): Promise<Did> {
  return Signer.fromPrivateKey(privateKey.padStart(64, "0")).getDid();
}

describe("mayRevokeToken", () => {
  it("allows the target token issuer and audience", async () => {
    const issuer = await didFor("1");
    const audience = await didFor("2");

    expect(mayRevokeToken(issuer, { iss: issuer, aud: audience })).toBe(true);
    expect(mayRevokeToken(audience, { iss: issuer, aud: audience })).toBe(true);
  });

  it("does not inherit revocation authority from a root subject", async () => {
    const root = await didFor("1");
    const audience = await didFor("2");
    const delegatedSigner = await didFor("3");

    expect(mayRevokeToken(delegatedSigner, { iss: root, aud: audience })).toBe(false);
  });
});
