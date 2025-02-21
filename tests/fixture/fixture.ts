import { faker } from "@faker-js/faker";
import dotenv from "dotenv";
import type { Hono } from "hono";
import { StatusCodes } from "http-status-codes";
import { UUID } from "mongodb";
import type { JsonObject } from "type-fest";
import { expect } from "vitest";
import { buildApp } from "#/app";
import { Identity } from "#/common/identity";
import { mongoMigrateUp } from "#/common/mongo";
import {
  type AppBindings,
  type AppEnv,
  EnvVarsSchema,
  loadBindings,
} from "#/env";
import type { QueryVariable } from "#/queries/queries.types";
import {
  TestAdminUserClient,
  TestOrganizationUserClient,
  TestRootUserClient,
} from "./test-client";

export type TestFixture = {
  id: string;
  app: Hono<AppEnv>;
  bindings: AppBindings;
  root: TestRootUserClient;
  admin: TestAdminUserClient;
  organization: TestOrganizationUserClient;
};

export async function buildFixture(
  opts: {
    schema?: SchemaFixture;
    query?: QueryFixture;
  } = {},
): Promise<TestFixture> {
  dotenv.config({ path: ".env.test" });
  const id = faker.string.alphanumeric(4);

  // Update db names, so that migrations performed during tests use the updated db names
  process.env.APP_DB_NAME_PRIMARY = `${process.env.APP_DB_NAME_PRIMARY}_${id}`;
  process.env.APP_DB_NAME_DATA = `${process.env.APP_DB_NAME_DATA}_${id}`;

  const config = EnvVarsSchema.parse({
    dbNamePrimary: process.env.APP_DB_NAME_PRIMARY,
    dbNameData: process.env.APP_DB_NAME_DATA,
    dbUri: process.env.APP_DB_URI,
    env: process.env.APP_ENV,
    logLevel: process.env.APP_LOG_LEVEL,
    nodeSecretKey: process.env.APP_NODE_SECRET_KEY,
    nodePublicEndpoint: process.env.APP_NODE_PUBLIC_ENDPOINT,
    metricsPort: Number(process.env.APP_METRICS_PORT),
    webPort: Number(process.env.APP_PORT),
  });

  const bindings = await loadBindings(config);
  await mongoMigrateUp(bindings.config.dbUri, bindings.config.dbNamePrimary);

  const { app } = buildApp(bindings);

  const node = {
    identity: Identity.fromSk(bindings.config.nodeSecretKey),
    endpoint: bindings.config.nodePublicEndpoint,
  };

  const root = new TestRootUserClient({
    app,
    identity: Identity.fromSk(bindings.config.nodeSecretKey),
    node,
  });
  const admin = new TestAdminUserClient({
    app,
    identity: Identity.new(),
    node,
  });
  const organization = new TestOrganizationUserClient({
    app,
    identity: Identity.new(),
    node,
  });

  await new Promise((resolve) => setTimeout(resolve, 1000));

  const createAdminResponse = await root.createAccount({
    did: admin._options.identity.did,
    publicKey: admin._options.identity.pk,
    name: faker.person.fullName(),
    type: "admin",
  });
  expect(createAdminResponse.ok).toBeTruthy();

  console.error("before create org request");
  const createOrgResponse = await admin.createAccount({
    did: organization._options.identity.did,
    publicKey: organization._options.identity.pk,
    name: faker.person.fullName(),
    type: "organization",
  });
  console.error("after create org request: ", createOrgResponse);
  expect(createOrgResponse.ok).toBeTruthy();

  if (opts.schema) {
    await registerSchemaAndQuery({
      organization,
      schema: opts.schema,
      query: opts.query,
    });
  }

  return { id, app, bindings, root, admin, organization };
}

export type SchemaFixture = {
  id: UUID;
  name: string;
  keys: string[];
  schema: JsonObject;
};

export type QueryFixture = {
  id: UUID;
  name: string;
  schema: UUID;
  variables: Record<string, QueryVariable>;
  pipeline: JsonObject[];
};

export async function registerSchemaAndQuery(opts: {
  organization: TestOrganizationUserClient;
  schema: SchemaFixture;
  query?: QueryFixture;
}): Promise<void> {
  const { organization, schema, query } = opts;

  schema.id = new UUID();
  const response = await organization.addSchema({
    _id: schema.id,
    name: schema.name,
    schema: schema.schema,
  });

  expect(response.status).toBe(StatusCodes.CREATED);

  if (query) {
    query.id = new UUID();
    query.schema = schema.id;
    const response = await organization.addQuery({
      _id: query.id,
      name: query.name,
      schema: query.schema,
      variables: query.variables,
      pipeline: query.pipeline,
    });

    expect(response.status).toBe(StatusCodes.CREATED);
  }
}
