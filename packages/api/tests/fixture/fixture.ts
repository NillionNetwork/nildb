/** biome-ignore-all lint/nursery/noImportCycles: this a cycle wrt fixture and response handler */
import { faker } from "@faker-js/faker";
import { type App, buildApp } from "@nildb/app";
import type { CollectionType } from "@nildb/collections/collections.types";
import { mongoMigrateUp } from "@nildb/common/mongo";
import { type AppBindings, FeatureFlag, hasFeatureFlag, loadBindings } from "@nildb/env";
import type { QueryVariable } from "@nildb/queries/queries.types";
import { secp256k1 } from "@noble/curves/secp256k1.js";
import { bytesToHex, hexToBytes } from "@noble/hashes/utils.js";
import dotenv from "dotenv";
import type { Logger } from "pino";
import type { JsonObject } from "type-fest";
import * as vitest from "vitest";

import { NilauthClient } from "@nillion/nilauth-client";
import { AdminClient, BuilderClient, UserClient } from "@nillion/nildb-client";
import { createUuidDto, NucCmd, type UuidDto } from "@nillion/nildb-types";
import { Builder, Did, type Did as NucDid, Signer } from "@nillion/nuc";

import { createTestLogger } from "./logger.js";
import { activateSubscriptionWithPayment } from "./payment.js";

export type FixtureContext = {
  id: string;
  log: Logger;
  app: App;
  bindings: AppBindings & {
    node: {
      signer: Signer;
      did: NucDid;
      publicKey: string;
      endpoint: string;
    };
  };
  system: AdminClient;
  builder: BuilderClient;
  builderSigner: Signer;
  user: UserClient;
  userSigner: Signer;
  expect: vitest.ExpectStatic;
};

export type CollectionFixture = {
  id: UuidDto;
  type: CollectionType;
  name: string;
  keys: string[];
  schema: JsonObject;
};

export type QueryFixture = {
  id: UuidDto;
  name: string;
  collection: UuidDto;
  variables: Record<string, QueryVariable>;
  pipeline: JsonObject[];
};

export async function buildFixture(
  opts: {
    collection?: CollectionFixture;
    query?: QueryFixture;
    keepDbs?: boolean;
  } = {},
): Promise<FixtureContext> {
  dotenv.config({
    path: ["./packages/api/env.test", "./packages/api/env.test.nilauthclient"],
  });
  const id = new Date().toISOString().replaceAll(":", "").replaceAll(".", "_");
  const log = createTestLogger(id);

  // Use unique db names for each test
  process.env.APP_DB_NAME_BASE = `${process.env.APP_DB_NAME_BASE}_${id}`;

  const currentFeatures = process.env.APP_ENABLED_FEATURES || "";
  const featuresArray = currentFeatures.split(",").filter(Boolean);

  process.env.APP_ENABLED_FEATURES = featuresArray.join(",");
  log.info(`Enabled features: ${process.env.APP_ENABLED_FEATURES}`);

  const bindings = await loadBindings();

  if (hasFeatureFlag(bindings.config.enabledFeatures, FeatureFlag.MIGRATIONS)) {
    await mongoMigrateUp(bindings.config.dbUri, bindings.config.dbNamePrimary);
    bindings.migrationsComplete = true;
    log.info("Ran db migrations");
  } else {
    bindings.migrationsComplete = true;
  }

  log.info("Bootstrapping test fixture");

  const { app } = await buildApp(bindings);

  const nodePrivateKeyBytes = hexToBytes(bindings.config.nodeSecretKey);
  const nodePublicKey = bytesToHex(secp256k1.getPublicKey(nodePrivateKeyBytes));
  const nodeSigner = Signer.fromPrivateKey(nodePrivateKeyBytes);
  const nodeDid = await nodeSigner.getDid();

  const node = {
    signer: nodeSigner,
    did: nodeDid,
    publicKey: nodePublicKey,
    endpoint: bindings.config.nodePublicEndpoint,
  };

  const nilauthBaseUrl = bindings.config.nilauthInstances[0].baseUrl;
  const chainId = bindings.config.nilauthChainId;

  // Create system client
  const adminPrivateKey = bytesToHex(secp256k1.utils.randomSecretKey());
  const adminSigner = Signer.fromPrivateKey(adminPrivateKey);
  const adminDid = await adminSigner.getDid();
  const nodeDelegation = await Builder.delegation()
    .subject(adminDid)
    .command(NucCmd.nil.db.root)
    .audience(adminDid)
    .expiresIn(1000 * 60 * 5)
    .sign(node.signer);
  const system = new AdminClient({
    baseUrl: bindings.config.nodePublicEndpoint,
    signer: adminSigner,
    nodePublicKey: node.publicKey,
    nodeDelegation,
    httpClient: app.request,
  });

  // Create builder client
  const builderSigner = Signer.fromPrivateKey(process.env.APP_TEST_BUILDER_PRIVATE_KEY!);

  const nilauth = await NilauthClient.create({
    baseUrl: nilauthBaseUrl,
    chainId,
  });

  const builder = new BuilderClient({
    baseUrl: bindings.config.nodePublicEndpoint,
    signer: builderSigner,
    nodePublicKey: node.publicKey,
    nilauth,
    httpClient: app.request,
  });

  // Create user client
  const userSigner = Signer.fromPrivateKey(process.env.APP_TEST_USER_PRIVATE_KEY!);
  const user = new UserClient({
    baseUrl: bindings.config.nodePublicEndpoint,
    signer: userSigner,
    nodePublicKey: node.publicKey,
    httpClient: app.request,
  });

  // this global expect gets replaced by the test effect
  const expect = vitest.expect;
  const c: FixtureContext = {
    id,
    log,
    app,
    bindings: {
      ...bindings,
      node,
    },
    expect,
    system,
    builder,
    builderSigner,
    user,
    userSigner,
  };

  // Register the builder
  // Activate subscription via real payment on Anvil
  const builderDid = await builderSigner.getDid();
  const anvilRpcUrl = process.env.APP_ANVIL_RPC_URL || "http://127.0.0.1:30545";
  await activateSubscriptionWithPayment(nilauth, builderDid, anvilRpcUrl);
  log.info({ did: Did.serialize(builderDid) }, "Builder subscription active");

  const registerResult = await builder.register({
    did: Did.serialize(builderDid),
    name: faker.person.fullName(),
  });
  if (!registerResult.ok) {
    throw new Error(`Failed to register builder: ${registerResult.error}`);
  }
  log.info({ did: builderDid }, "Builder registered");

  if (opts.collection) {
    const { collection, query } = opts;

    collection.id = createUuidDto();
    const collectionResult = await builder.createCollection({
      _id: collection.id,
      type: collection.type,
      name: collection.name,
      schema: collection.schema,
    });
    if (!collectionResult.ok) {
      throw new Error(`Failed to create collection: ${collectionResult.error}`);
    }

    log.info({ id: collection.id }, "Schema registered");

    if (query) {
      log.info("Registering query");
      query.id = createUuidDto();
      query.collection = collection.id;
      const queryResult = await builder.createQuery({
        _id: query.id,
        name: query.name,
        collection: query.collection,
        variables: query.variables,
        pipeline: query.pipeline,
      });
      if (!queryResult.ok) {
        throw new Error(`Failed to create query: ${queryResult.error}`);
      }

      log.info({ id: query.id }, "Query registered");
    }

    log.info("Test suite ready");
  }
  return c;
}
