import { faker } from "@faker-js/faker";
import { Builder, Signer } from "@nillion/nuc";
import { secp256k1 } from "@noble/curves/secp256k1.js";
import { bytesToHex } from "@noble/hashes/utils.js";
import { describe } from "vitest";
import { PathsV1 } from "#/common/paths";
import { createTestFixtureExtension } from "#tests/fixture/it";
import { createBuilderTestClient } from "#tests/fixture/test-client";

describe("did:nil to did:key auth translation", () => {
  const { it, beforeAll, afterAll } = createTestFixtureExtension({});

  beforeAll(async (_c) => {});
  afterAll(async (_c) => {});

  it("should authenticate a legacy did:nil token against a did:key record", async ({
    c,
  }) => {
    const {
      expect,
      builder,
      bindings: {
        node,
        config: { nilauthBaseUrl },
      },
      app,
    } = c;

    // 1. Create a single private key to represent one identity
    const privateKey = bytesToHex(secp256k1.utils.randomSecretKey());

    // 2. Create two signers from this key: one for the canonical `did:key` format and one for the legacy `did:nil` format
    const keySigner = Signer.fromPrivateKey(privateKey, "key");
    const nilSigner = Signer.fromPrivateKey(privateKey, "nil");
    const didKey = await keySigner.getDid();
    const didNil = await nilSigner.getDid();

    // 3. Create a test client using the `did:key` signer
    const builderClient = await createBuilderTestClient({
      app,
      privateKey,
      chainUrl: process.env.APP_NILCHAIN_JSON_RPC!,
      nilauthBaseUrl,
      nodePublicKey: node.publicKey,
    });

    console.error("builder: ", {
      key: didKey.didString,
      nil: didNil.didString,
    });

    // 4. We can't use `ensureSubscriptionActive` because this builder's nilchain account isn't funded
    // so we'll use the fixture provided builder's payer to pay the subscription
    const { nilauth } = builderClient._options;
    const cost = await nilauth.subscriptionCost("nildb");
    const { resourceHash, payload } = nilauth.createPaymentResource(
      didKey,
      "nildb",
      await builder._options.signer.getDid(),
    );
    const txHash = await builder._options.payer.pay(resourceHash, cost);
    await nilauth.validatePayment(txHash, payload, builder._options.signer);

    // 5. Register the builder using the `did:key` format
    await builderClient
      .register(c, {
        did: didKey.didString,
        name: faker.person.fullName(),
      })
      .expectSuccess();

    // 6. Verify that the builder can access their profile using a standard `did:key` token
    const profile = await builderClient.getProfile(c).expectSuccess();
    expect(profile.data._id).toBe(didKey.didString);

    // 7. Verify that the builder can access their profile using a legacy `did:nil` token
    // Get a root token for the subscribed `did:key` identity
    const { token: rootToken } = await nilauth.requestToken(keySigner, "nildb");

    // Delegate the read capability from the `did:key` identity to the `did:nil` identity
    const delegationToNil = await Builder.delegationFrom(rootToken)
      .audience(didNil)
      .command("/nil/db/builders/read")
      .sign(keySigner);

    // Now, the `did:nil` identity invokes the capability it was granted
    const legacyToken = await Builder.invocationFrom(delegationToNil)
      .audience(node.did)
      .signAndSerialize(nilSigner);

    const response = await app.request(PathsV1.builders.me, {
      headers: {
        Authorization: `Bearer ${legacyToken}`,
      },
    });

    // 8. Assert that the request was successful and returned the correct builder profile
    expect(response.status).toBe(200);
    const body = (await response.json()) as any;
    expect(body.data._id).toBe(didKey.didString);
  }, 0);
});
