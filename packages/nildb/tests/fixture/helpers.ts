import { faker } from "@faker-js/faker";
import { Did } from "@nillion/nuc";
import { secp256k1 } from "@noble/curves/secp256k1.js";
import { bytesToHex } from "@noble/hashes/utils.js";
import type { FixtureContext } from "./fixture.js";
import {
  type BuilderTestClient,
  createBuilderTestClient,
} from "./test-client.js";

export async function createRegisteredBuilder(
  c: FixtureContext,
  name?: string,
): Promise<BuilderTestClient> {
  const { app, bindings } = c;

  const builderPrivateKey = bytesToHex(secp256k1.utils.randomSecretKey());

  const builder = await createBuilderTestClient({
    app,
    privateKey: builderPrivateKey,
    chainUrl: process.env.APP_NILCHAIN_JSON_RPC!,
    nilauthBaseUrl: bindings.config.nilauthBaseUrl,
    nodePublicKey: bindings.node.publicKey,
  });

  await builder.ensureSubscriptionActive();

  const builderDid = await builder.getDid();
  await builder
    .register(c, {
      did: Did.serialize(builderDid),
      name: name ?? faker.person.fullName(),
    })
    .expectSuccess();

  return builder;
}
