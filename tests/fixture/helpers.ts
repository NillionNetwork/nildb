import { faker } from "@faker-js/faker";
import { Did, Keypair } from "@nillion/nuc";
import type { FixtureContext } from "./fixture";
import { type BuilderTestClient, createBuilderTestClient } from "./test-client";

export async function createRegisteredBuilder(
  c: FixtureContext,
  name?: string,
): Promise<BuilderTestClient> {
  const { app, bindings } = c;

  const builder = await createBuilderTestClient({
    app,
    keypair: Keypair.generate(),
    chainUrl: process.env.APP_NILCHAIN_JSON_RPC!,
    nilauthBaseUrl: bindings.config.nilauthBaseUrl,
    nodePublicKey: bindings.node.keypair.publicKey(),
  });

  await builder.ensureSubscriptionActive();

  await builder
    .register(c, {
      did: Did.serialize(builder.did),
      name: name ?? faker.person.fullName(),
    })
    .expectSuccess();

  return builder;
}
