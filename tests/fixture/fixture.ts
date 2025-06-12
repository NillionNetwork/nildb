import { faker } from "@faker-js/faker";
import { Keypair } from "@nillion/nuc";
import dotenv from "dotenv";
import { UUID } from "mongodb";
import type { Logger } from "pino";
import type { JsonObject } from "type-fest";
import * as vitest from "vitest";
import { type App, buildApp } from "#/app";
import type { CollectionType } from "#/collections/collections.types";
import { mongoMigrateUp } from "#/common/mongo";
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
  // biome-ignore lint/nursery/noImportCycles: this cycle resolves correctly, is limited to testing, and avoids an overly large fixture file
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
  admin: AdminTestClient;
  builder: BuilderTestClient;
  user: UserTestClient;
  expect: vitest.ExpectStatic;
};

export type SchemaFixture = {
  id: UUID;
  name: string;
  keys: string[];
  schema: JsonObject;
  documentType: CollectionType;
};

export type QueryFixture = {
  id: UUID;
  name: string;
  schema: UUID;
  variables: Record<string, QueryVariable>;
  pipeline: JsonObject[];
};

export async function buildFixture(
  opts: {
    schema?: SchemaFixture;
    query?: QueryFixture;
    keepDbs?: boolean;
  } = {},
): Promise<FixtureContext> {
  dotenv.config({ path: [".env.test", ".env.test.nilauthclient"] });
  const id = faker.string.alphanumeric({ length: 4, casing: "lower" });
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

  const chainUrl = process.env.APP_NILCHAIN_JSON_RPC;
  const nilauthBaseUrl = bindings.config.nilauthBaseUrl;

  // Create admin client - uses node's keypair for system administration
  const admin = await createAdminTestClient({
    app,
    keypair: node.keypair,
    nodePublicKey: node.keypair.publicKey("hex"),
  });

  // Create builder client with subscription and nilauth
  const builder = await createBuilderTestClient({
    app,
    keypair: Keypair.from(process.env.APP_NILCHAIN_PRIVATE_KEY_0!),
    chainUrl,
    nilauthBaseUrl,
    nodePublicKey: node.keypair.publicKey("hex"),
  });

  // Create user client - data owner with self-signed tokens
  const user = await createUserTestClient({
    app,
    keypair: Keypair.from(process.env.APP_NILCHAIN_PRIVATE_KEY_1!),
    nodePublicKey: node.keypair.publicKey("hex"),
  });

  // this global expect gets replaced by the test effect
  const expect = vitest.expect;
  const c: FixtureContext = {
    id,
    log,
    app,
    bindings,
    expect,
    admin,
    builder,
    user,
  };

  // Register the builder
  await builder.ensureSubscriptionActive();
  log.info({ did: builder.did }, "Builder subscription active");

  await builder
    .register(c, {
      did: builder.did,
      name: faker.person.fullName(),
    })
    .expectSuccess();
  log.info({ did: builder.did }, "Builder registered");

  if (opts.schema) {
    const { schema, query } = opts;

    schema.id = new UUID();
    await builder
      .addSchema(c, {
        _id: schema.id,
        name: schema.name,
        collection: schema.schema,
        documentType: schema.documentType,
      })
      .expectSuccess();

    log.info({ id: schema.id }, "Schema registered");

    if (query) {
      log.info("Registering query");
      query.id = new UUID();
      query.schema = schema.id;
      await builder
        .addQuery(c, {
          _id: query.id,
          name: query.name,
          collection: query.schema,
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
