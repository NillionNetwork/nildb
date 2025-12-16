import { faker } from "@faker-js/faker";
import type { App } from "@nildb/app";
import { NilauthClient } from "@nillion/nilauth-client";
import { BuilderClient, UserClient } from "@nillion/nildb-client";
import { Did, Signer } from "@nillion/nuc";
import { secp256k1 } from "@noble/curves/secp256k1.js";
import { bytesToHex } from "@noble/hashes/utils.js";
import type { FixtureContext } from "./fixture.js";
import { activateSubscriptionWithPayment } from "./payment.js";

export async function createRegisteredBuilder(
  c: FixtureContext,
  name?: string,
): Promise<BuilderClient> {
  const { app, bindings } = c;

  const builderPrivateKey = bytesToHex(secp256k1.utils.randomSecretKey());
  const builderSigner = Signer.fromPrivateKey(builderPrivateKey);

  const nilauth = await NilauthClient.create({
    baseUrl: bindings.config.nilauthInstances[0].baseUrl,
    chainId: bindings.config.nilauthChainId,
  });

  const builder = new BuilderClient({
    baseUrl: bindings.config.nodePublicEndpoint,
    signer: builderSigner,
    nodePublicKey: bindings.node.publicKey,
    nilauth,
    httpClient: app.request,
  });

  // Activate subscription via real payment on Anvil
  const builderDid = await builderSigner.getDid();
  const anvilRpcUrl = process.env.APP_ANVIL_RPC_URL || "http://127.0.0.1:30545";
  await activateSubscriptionWithPayment(nilauth, builderDid, anvilRpcUrl);

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
  chainId: number;
  nilauthBaseUrl: string;
  nodePublicKey: string;
}): Promise<BuilderClient> {
  const { app, privateKey, chainId, nilauthBaseUrl, nodePublicKey } = options;

  const builderSigner = Signer.fromPrivateKey(privateKey);

  const nilauth = await NilauthClient.create({
    baseUrl: nilauthBaseUrl,
    chainId,
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
