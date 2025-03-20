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
  type AppBindingsWithNilcomm,
  type AppEnv,
  EnvVarsSchema,
  FeatureFlag,
  hasFeatureFlag,
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
  bindings: AppBindingsWithNilcomm;
  root: TestRootUserClient;
  admin: TestAdminUserClient;
  organization: TestOrganizationUserClient;
};

export async function buildFixture(
  opts: {
    schema?: SchemaFixture;
    query?: QueryFixture;
    keepDbs?: boolean;
    enableNilcomm?: boolean;
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
    enabledFeatures: process.env.APP_ENABLED_FEATURES
      ? process.env.APP_ENABLED_FEATURES.split(",")
      : [],
    logLevel: process.env.APP_LOG_LEVEL,
    mqUri: process.env.APP_MQ_URI,
    nilcommPublicKey: process.env.APP_NILCOMM_PUBLIC_KEY,
    nodeSecretKey: process.env.APP_NODE_SECRET_KEY,
    nodePublicEndpoint: process.env.APP_NODE_PUBLIC_ENDPOINT,
    metricsPort: Number(process.env.APP_METRICS_PORT),
    webPort: Number(process.env.APP_PORT),
  });

  if (opts.enableNilcomm) {
    config.enabledFeatures.push("nilcomm");
  }

  const bindings = (await loadBindings(config)) as AppBindingsWithNilcomm;

  if (hasFeatureFlag(bindings.config.enabledFeatures, FeatureFlag.MIGRATIONS)) {
    await mongoMigrateUp(bindings.config.dbUri, bindings.config.dbNamePrimary);
  }

  const { app } = await buildApp(bindings);

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

  bindings.log.info("Creating admin account...");
  try {
    const createAdminResponse = await root.createAccount({
      did: admin._options.identity.did,
      publicKey: admin._options.identity.pk,
      name: faker.person.fullName(),
      type: "admin",
    });

    if (!createAdminResponse.ok) {
      const responseBody = await createAdminResponse.text();
      console.error("Admin creation failed:", {
        status: createAdminResponse.status,
        body: responseBody,
      });
    }

    expect(createAdminResponse.ok).toBeTruthy();
    bindings.log.info("Admin account created successfully");
  } catch (error) {
    bindings.log.error("Error creating admin account:", error);
    throw error;
  }

  bindings.log.info("Creating organization account...");
  try {
    const createOrgResponse = await admin.createAccount({
      did: organization._options.identity.did,
      publicKey: organization._options.identity.pk,
      name: faker.person.fullName(),
      type: "organization",
    });

    if (!createOrgResponse.ok) {
      const responseBody = await createOrgResponse.text();
      console.error("Organization creation failed:", {
        status: createOrgResponse.status,
        body: responseBody,
      });
    }

    expect(createOrgResponse.ok).toBeTruthy();
    console.log("Organization account created successfully");
  } catch (error) {
    console.error("Error creating organization account:", error);
    throw error;
  }

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

  try {
    console.log("Registering schema...");
    schema.id = new UUID();
    const response = await organization.addSchema({
      _id: schema.id,
      name: schema.name,
      schema: schema.schema,
    });

    if (response.status !== StatusCodes.CREATED) {
      const responseBody = await response.text();
      console.error("Schema registration failed:", {
        status: response.status,
        body: responseBody,
      });
    }

    expect(response.status).toBe(StatusCodes.CREATED);
    console.log(
      "Schema registered successfully with ID:",
      schema.id.toString(),
    );

    if (query) {
      console.log("Registering query...");
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
        const responseBody = await queryResponse.text();
        console.error("Query registration failed:", {
          status: queryResponse.status,
          body: responseBody,
        });
      }

      expect(queryResponse.status).toBe(StatusCodes.CREATED);
      console.log(
        "Query registered successfully with ID:",
        query.id.toString(),
      );
    }
  } catch (error) {
    console.error("Error registering schema or query:", error);
    throw error;
  }
}
