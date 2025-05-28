import { faker } from "@faker-js/faker";
import { Keypair, NilauthClient, PayerBuilder } from "@nillion/nuc";
import dotenv from "dotenv";
import { StatusCodes } from "http-status-codes";
import { UUID } from "mongodb";
import { type Logger, pino } from "pino";
import type { JsonObject } from "type-fest";
import type * as vitest from "vitest";
import { type App, buildApp } from "#/app";
import { mongoMigrateUp } from "#/common/mongo";
import {
  type AppBindingsWithNilcomm,
  FeatureFlag,
  hasFeatureFlag,
  loadBindings,
} from "#/env";
import type { QueryVariable } from "#/queries/queries.types";
import type { SchemaDocumentType } from "#/schemas/schemas.repository";
import { TestOrganizationUserClient, TestRootUserClient } from "./test-client";

export type FixtureContext = {
  id: string;
  log: Logger;
  app: App;
  bindings: AppBindingsWithNilcomm;
  root: TestRootUserClient;
  organization: TestOrganizationUserClient;
  expect: vitest.ExpectStatic;
};

function createTestLogger(id: string): Logger {
  return pino({
    transport: {
      target: "pino-pretty",
      options: {
        sync: true,
        singleLine: true,
        messageFormat: `${id} - {msg}`,
      },
    },
  });
}

export async function buildFixture(
  opts: {
    schema?: SchemaFixture;
    query?: QueryFixture;
    keepDbs?: boolean;
    enableNilcomm?: boolean;
  } = {},
): Promise<Omit<FixtureContext, "expect">> {
  dotenv.config({ path: [".env.test", ".env.test.nilauthclient"] });
  const id = faker.string.alphanumeric({ length: 4, casing: "lower" });
  const log = createTestLogger(id);

  // Use unique db names for each test
  process.env.APP_DB_NAME_PRIMARY = `${process.env.APP_DB_NAME_PRIMARY}_${id}`;
  process.env.APP_DB_NAME_DATA = `${process.env.APP_DB_NAME_DATA}_${id}`;
  process.env.APP_DB_NAME_PERMISSIONS = `${process.env.APP_DB_NAME_PERMISSIONS}_${id}`;

  // nilcomm should only be enabled via the test fixture params else consumers and producers conflict
  const currentFeatures = process.env.APP_ENABLED_FEATURES || "";
  const featuresArray = currentFeatures.split(",").filter(Boolean);

  if (opts.enableNilcomm && !featuresArray.includes("nilcomm")) {
    featuresArray.push("nilcomm");
  }
  process.env.APP_ENABLED_FEATURES = featuresArray.join(",");
  log.info(`Enabled features: ${process.env.APP_ENABLED_FEATURES}`);

  const bindings = (await loadBindings()) as AppBindingsWithNilcomm;

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
  const adminKeypair = Keypair.from(process.env.APP_NILCHAIN_PRIVATE_KEY_0!);
  const adminPayer = await new PayerBuilder()
    .keypair(adminKeypair)
    .chainUrl(chainUrl)
    .build();

  const adminNilauthClient = await NilauthClient.from({
    keypair: node.keypair,
    payer: adminPayer,
    baseUrl: bindings.config.nilauthBaseUrl,
  });

  const root = new TestRootUserClient({
    app,
    keypair: node.keypair,
    payer: adminPayer,
    nilauth: adminNilauthClient,
    node,
  });

  const orgKeypair = Keypair.from(process.env.APP_NILCHAIN_PRIVATE_KEY_1!);
  const orgPayer = await new PayerBuilder()
    .keypair(orgKeypair)
    .chainUrl(chainUrl)
    .build();
  const orgNilauthClient = await NilauthClient.from({
    keypair: orgKeypair,
    payer: orgPayer,
    baseUrl: bindings.config.nilauthBaseUrl,
  });
  const organization = new TestOrganizationUserClient({
    app,
    keypair: orgKeypair,
    payer: orgPayer,
    nilauth: orgNilauthClient,
    node,
  });

  const c = { id, log, app, bindings, root, organization };

  await organization.ensureSubscriptionActive();
  const createOrgResponse = await organization.register({
    did: organization.keypair.toDidString(),
    name: faker.person.fullName(),
  });

  if (!createOrgResponse.ok) {
    throw new Error("Failed to create the organization", {
      cause: createOrgResponse,
    });
  }
  log.info({ did: organization.did }, "Created organization");

  if (opts.schema) {
    await registerSchemaAndQuery({
      c,
      organization,
      schema: opts.schema,
      query: opts.query,
    });
  }

  log.info("Test suite ready");
  return c;
}

export type SchemaFixture = {
  id: UUID;
  name: string;
  keys: string[];
  schema: JsonObject;
  documentType: SchemaDocumentType;
};

export type QueryFixture = {
  id: UUID;
  name: string;
  schema: UUID;
  variables: Record<string, QueryVariable>;
  pipeline: JsonObject[];
};

export async function registerSchemaAndQuery(opts: {
  c: Omit<FixtureContext, "expect">;
  organization: TestOrganizationUserClient;
  schema: SchemaFixture;
  query?: QueryFixture;
}): Promise<void> {
  const { c, organization, schema, query } = opts;
  const { log } = c;

  await organization.ensureSubscriptionActive();
  log.info({ did: organization.did }, "Organization subscription active");

  schema.id = new UUID();
  const response = await organization.addSchema({
    _id: schema.id,
    name: schema.name,
    schema: schema.schema,
    documentType: schema.documentType,
  });

  if (response.status !== StatusCodes.CREATED) {
    throw new Error("Failed to register schema");
  }
  log.info({ id: schema.id }, "Schema registered");

  if (query) {
    log.info("Registering query");
    query.id = new UUID();
    query.schema = schema.id;
    const queryResponse = await organization.addQuery({
      _id: query.id,
      name: query.name,
      schema: query.schema,
      variables: query.variables,
      pipeline: query.pipeline,
    });

    if (queryResponse.status !== StatusCodes.CREATED) {
      throw new Error("Failed to register the query");
    }
    log.info({ id: query.id }, "Query registered");
  }
}
