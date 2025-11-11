import { faker } from "@faker-js/faker";
import type { App } from "@nildb/app";
import { BuilderClient, UserClient } from "@nillion/nildb-client";
import { Did, NilauthClient, PayerBuilder, Signer } from "@nillion/nuc";
import { secp256k1 } from "@noble/curves/secp256k1.js";
import { bytesToHex } from "@noble/hashes/utils.js";
import { vi } from "vitest";
import type { FixtureContext } from "./fixture.js";

export async function createRegisteredBuilder(
  c: FixtureContext,
  name?: string,
): Promise<BuilderClient> {
  const { app, bindings } = c;

  const builderPrivateKey = bytesToHex(secp256k1.utils.randomSecretKey());
  const builderSigner = Signer.fromPrivateKey(builderPrivateKey);

  const payer = await PayerBuilder.fromPrivateKey(builderPrivateKey)
    .chainUrl(process.env.APP_NILCHAIN_JSON_RPC!)
    .build();

  const nilauth = await NilauthClient.create({
    baseUrl: bindings.config.nilauthBaseUrl,
    payer,
  });

  const builder = new BuilderClient({
    baseUrl: bindings.config.nodePublicEndpoint,
    signer: builderSigner,
    nodePublicKey: bindings.node.publicKey,
    nilauth,
    httpClient: app.request,
  });

  // Ensure subscription is active
  const builderDid = await builderSigner.getDid();
  const checkSubscription = async () => {
    const response = await nilauth.subscriptionStatus(builderDid, "nildb");
    if (response.subscribed) return;
    await nilauth
      .payAndValidate(builderSigner, builderDid, "nildb")
      .catch(() => {});
    throw new Error("Subscription not yet active");
  };
  await vi.waitFor(checkSubscription, { timeout: 10000, interval: 500 });

  const registerResult = await builder.register({
    did: Did.serialize(builderDid),
    name: name ?? faker.person.fullName(),
  });

  if (!registerResult.ok) {
    throw new Error(`Failed to register builder: ${registerResult.error}`);
  }

  return builder;
}

export async function createBuilderTestClient(options: {
  app: App;
  privateKey: string;
  chainUrl: string;
  nilauthBaseUrl: string;
  nodePublicKey: string;
}): Promise<BuilderClient> {
  const { app, privateKey, chainUrl, nilauthBaseUrl, nodePublicKey } = options;

  const builderSigner = Signer.fromPrivateKey(privateKey);

  const payer = await PayerBuilder.fromPrivateKey(privateKey)
    .chainUrl(chainUrl)
    .build();

  const nilauth = await NilauthClient.create({
    baseUrl: nilauthBaseUrl,
    payer,
  });

  const builder = new BuilderClient({
    baseUrl: "http://localhost:3000",
    signer: builderSigner,
    nodePublicKey,
    nilauth,
    httpClient: app.request,
  });

  return builder;
}

export async function createUserTestClient(options: {
  app: App;
  privateKey: string;
  nodePublicKey: string;
}): Promise<UserClient> {
  const { app, privateKey, nodePublicKey } = options;

  const userSigner = Signer.fromPrivateKey(privateKey);

  const user = new UserClient({
    baseUrl: "http://localhost:3000",
    signer: userSigner,
    nodePublicKey,
    httpClient: app.request,
  });

  return user;
}
