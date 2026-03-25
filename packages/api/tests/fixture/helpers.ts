import type { App } from "@nildb/app";

import { BuilderClient, UserClient } from "@nillion/nildb-client";
import { Signer } from "@nillion/nuc";

import type { FixtureContext } from "./fixture";
import { insertTestBuilder } from "./fixture";

export async function createRegisteredBuilder(
  c: FixtureContext,
  name?: string,
): Promise<{ client: BuilderClient; signer: Signer }> {
  const { app, bindings } = c;

  const { signer, did: _did } = await insertTestBuilder(bindings, name);

  const client = new BuilderClient({
    baseUrl: bindings.config.nodePublicEndpoint,
    signer,
    nodePublicKey: bindings.node.publicKey,
    httpClient: app.request,
  });

  return { client, signer };
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
