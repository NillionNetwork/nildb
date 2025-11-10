/** biome-ignore-all lint/nursery/noImportCycles: this a cycle wrt fixture and response handler */
import { faker } from "@faker-js/faker";
import { type App, buildApp } from "@nildb/app";
import type { CollectionType } from "@nildb/collections/collections.types";
import { mongoMigrateUp } from "@nildb/common/mongo";
import {
  type AppBindings,
  FeatureFlag,
  hasFeatureFlag,
  loadBindings,
} from "@nildb/env";
import type { QueryVariable } from "@nildb/queries/queries.types";
import { createUuidDto, NucCmd, type UuidDto } from "@nillion/nildb-types";
import { Builder, Did, type Did as NucDid, Signer } from "@nillion/nuc";
import { secp256k1 } from "@noble/curves/secp256k1.js";
import { bytesToHex, hexToBytes } from "@noble/hashes/utils.js";
import dotenv from "dotenv";
import type { Logger } from "pino";
import type { JsonObject } from "type-fest";
import * as vitest from "vitest";
import { createTestLogger } from "./logger.js";
import {
  type AdminTestClient,
  type BuilderTestClient,
  createAdminTestClient,
  createBuilderTestClient,
  createUserTestClient,
  type UserTestClient,
} from "./test-client.js";

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
  system: AdminTestClient;
  builder: BuilderTestClient;
  user: UserTestClient;
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
    path: [
      "./packages/nildb/.env.test",
      "./packages/nildb/.env.test.nilauthclient",
    ],
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

  const chainUrl = process.env.APP_NILCHAIN_JSON_RPC!;
  const nilauthBaseUrl = bindings.config.nilauthBaseUrl;

  // Create system client
  const adminPrivateKey = bytesToHex(secp256k1.utils.randomSecretKey());
  const adminSigner = Signer.fromPrivateKey(adminPrivateKey);
  const adminDid = await adminSigner.getDid();
  const nodeDelegation = await Builder.delegation()
    .subject(adminDid)
    .command(NucCmd.nil.db.root)
    .audience(adminDid)
    .sign(node.signer);
  const system = await createAdminTestClient({
    app,
    privateKey: adminPrivateKey,
    nodePublicKey: node.publicKey,
    nodeDelegation,
  });

  // Create builder client
  const builder = await createBuilderTestClient({
    app,
    privateKey: process.env.APP_NILCHAIN_PRIVATE_KEY_0!,
    chainUrl,
    nilauthBaseUrl,
    nodePublicKey: node.publicKey,
  });

  // Create user client
  const user = await createUserTestClient({
    app,
    privateKey: process.env.APP_NILCHAIN_PRIVATE_KEY_1!,
    nodePublicKey: node.publicKey,
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
    user,
  };

  // Register the builder
  await builder.ensureSubscriptionActive();
  const builderDid = await builder.getDid();
  log.info({ did: Did.serialize(builderDid) }, "Builder subscription active");

  await builder
    .register(c, {
      did: Did.serialize(builderDid),
      name: faker.person.fullName(),
    })
    .expectSuccess();
  log.info({ did: builderDid }, "Builder registered");

  if (opts.collection) {
    const { collection, query } = opts;

    collection.id = createUuidDto();
    await builder
      .createCollection(c, {
        _id: collection.id,
        type: collection.type,
        name: collection.name,
        schema: collection.schema,
      })
      .expectSuccess();

    log.info({ id: collection.id }, "Schema registered");

    if (query) {
      log.info("Registering query");
      query.id = createUuidDto();
      query.collection = collection.id;
      await builder
        .createQuery(c, {
          _id: query.id,
          name: query.name,
          collection: query.collection,
          variables: query.variables,
          pipeline: query.pipeline,
        })
        .expectSuccess();

      log.info({ id: query.id }, "Query registered");
    }

    log.info("Test suite ready");
  }
  return c;
}
