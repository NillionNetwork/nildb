/** biome-ignore-all lint/nursery/noImportCycles: this a cycle wrt fixture and response handler */
import { faker } from "@faker-js/faker";
import { Builder, Did, Keypair } from "@nillion/nuc";
import dotenv from "dotenv";
import type { Logger } from "pino";
import type { JsonObject } from "type-fest";
import * as vitest from "vitest";
import { type App, buildApp } from "#/app";
import type { CollectionType } from "#/collections/collections.types";
import { mongoMigrateUp } from "#/common/mongo";
import { NucCmd } from "#/common/nuc-cmd-tree";
import { createUuidDto, type UuidDto } from "#/common/types";
import {
  type AppBindings,
  FeatureFlag,
  hasFeatureFlag,
  loadBindings,
} from "#/env";
import type { QueryVariable } from "#/queries/queries.types";
import { createTestLogger } from "./logger";
import {
  type AdminTestClient,
  type BuilderTestClient,
  createAdminTestClient,
  createBuilderTestClient,
  createUserTestClient,
  type UserTestClient,
} from "./test-client";

export type FixtureContext = {
  id: string;
  log: Logger;
  app: App;
  bindings: AppBindings & {
    node: {
      keypair: Keypair;
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
  dotenv.config({ path: [".env.test", ".env.test.nilauthclient"] });
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
    log.info("Ran db migrations");
  }

  log.info("Bootstrapping test fixture");

  const { app } = await buildApp(bindings);

  const node = {
    keypair: Keypair.from(bindings.config.nodeSecretKey),
    endpoint: bindings.config.nodePublicEndpoint,
  };

  const chainUrl = process.env.APP_NILCHAIN_JSON_RPC!;
  const nilauthBaseUrl = bindings.config.nilauthBaseUrl;

  // Create system client - uses node's keypair for system administration
  const adminKeypair = Keypair.generate();
  const nodeDelegation = await Builder.delegation()
    .subject(adminKeypair.toDid())
    .command(NucCmd.nil.db.root)
    .audience(adminKeypair.toDid())
    .sign(node.keypair.signer());
  const system = await createAdminTestClient({
    app,
    keypair: adminKeypair,
    nodePublicKey: node.keypair.publicKey(),
    nodeDelegation,
  });

  // Create builder client with subscription and nilauth
  const builder = await createBuilderTestClient({
    app,
    keypair: Keypair.from(process.env.APP_NILCHAIN_PRIVATE_KEY_0!),
    chainUrl,
    nilauthBaseUrl,
    nodePublicKey: node.keypair.publicKey(),
  });

  // Create user client - data owner with self-signed tokens
  const user = await createUserTestClient({
    app,
    keypair: Keypair.from(process.env.APP_NILCHAIN_PRIVATE_KEY_1!),
    nodePublicKey: node.keypair.publicKey(),
  });

  // this global expect gets replaced by the test effect
  const expect = vitest.expect;
  const c: FixtureContext = {
    id,
    log,
    app,
    bindings,
    expect,
    system,
    builder,
    user,
  };

  // Register the builder
  await builder.ensureSubscriptionActive();
  log.info({ did: Did.serialize(builder.did) }, "Builder subscription active");

  await builder
    .register(c, {
      did: Did.serialize(builder.did),
      name: faker.person.fullName(),
    })
    .expectSuccess();
  log.info({ did: builder.did }, "Builder registered");

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
