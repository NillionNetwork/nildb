import { faker } from "@faker-js/faker";
import { Keypair } from "@nillion/nuc";
import { StatusCodes } from "http-status-codes";
import { describe } from "vitest";
import { PathsV1 } from "#/common/paths";
import { createUuidDto } from "#/common/types";
import queryJson from "./data/simple.query.json";
import schemaJson from "./data/simple.schema.json";
import { expectErrorResponse } from "./fixture/assertions";
import type { QueryFixture, SchemaFixture } from "./fixture/fixture";
import { createTestFixtureExtension } from "./fixture/it";
import { TestOrganizationUserClient } from "./fixture/test-client";

describe("account access controls", () => {
  const schema = schemaJson as unknown as SchemaFixture;
  const query = queryJson as unknown as QueryFixture;
  const { it, beforeAll, afterAll } = createTestFixtureExtension({
    schema,
    query,
  });
  beforeAll(async (_ctx) => {});
  afterAll(async (_ctx) => {});

  it("rejects unauthenticated requests", async ({ expect, admin }) => {
    const response = await admin.app.request(PathsV1.accounts.root);
    expect(response.status).toBe(StatusCodes.UNAUTHORIZED);
  });

  it("organizations cannot create admin accounts", async ({
    organization,
    expect,
  }) => {
    const keypair = Keypair.generate();
    const response = await organization.request(PathsV1.admin.accounts.root, {
      method: "POST",
      body: {
        did: organization.did,
        publicKey: keypair.publicKey("hex"),
        name: faker.person.fullName(),
        type: "admin",
      },
    });

    expect(response.status).toBe(StatusCodes.FORBIDDEN);
  });

  it("organizations cannot list accounts", async ({ organization, expect }) => {
    const response = await organization.request(PathsV1.admin.accounts.root);
    expect(response.status).toBe(StatusCodes.FORBIDDEN);
  });
});

describe("restrict cross organization operations", () => {
  const schema = schemaJson as unknown as SchemaFixture;
  const query = queryJson as unknown as QueryFixture;
  const { it, beforeAll, afterAll } = createTestFixtureExtension({
    schema,
    query,
  });
  afterAll(async (_ctx) => {});

  let organizationB: TestOrganizationUserClient;
  const collectionSize = 10;
  const data = Array.from({ length: collectionSize }, () => ({
    _id: createUuidDto(),
    name: faker.person.fullName(),
  }));

  beforeAll(async ({ app, bindings, organization }) => {
    await organization.uploadData({
      schema: schema.id,
      data,
    });

    organizationB = new TestOrganizationUserClient({
      app: app,
      keypair: Keypair.generate(),
      payer: organization._options.payer,
      nilauth: organization._options.nilauth,
      node: bindings.node,
    });

    await organizationB.ensureSubscriptionActive();

    await organizationB.register({
      did: organizationB.did,
      name: faker.company.name(),
    });
  });

  it("prevents data upload", async ({ expect }) => {
    const response = await organizationB.uploadData({
      schema: schema.id,
      data: [
        {
          _id: createUuidDto(),
          name: faker.person.fullName(),
        },
      ],
    });

    const error = await expectErrorResponse(response);
    expect(error.errors).includes("ResourceAccessDeniedError");
  });

  it("prevents data reads", async ({ expect }) => {
    const response = await organizationB.readData({
      schema: schema.id,
      filter: {},
    });

    const error = await expectErrorResponse(response);
    expect(error.errors).includes("ResourceAccessDeniedError");
  });

  it("prevents data updates", async ({ expect }) => {
    const record = data[Math.floor(Math.random() * collectionSize)];
    const response = await organizationB.updateData({
      schema: schema.id,
      filter: { name: record.name },
      update: { name: "foo" },
    });

    const error = await expectErrorResponse(response);
    expect(error.errors).includes("ResourceAccessDeniedError");
  });

  it("prevents data deletes", async ({ expect }) => {
    const record = data[Math.floor(Math.random() * collectionSize)];
    const response = await organizationB.deleteData({
      schema: schema.id,
      filter: { name: record.name },
    });

    const error = await expectErrorResponse(response);
    expect(error.errors).includes("ResourceAccessDeniedError");
  });

  it("prevents data flush", async ({ expect }) => {
    const response = await organizationB.flushData({
      schema: schema.id,
    });

    const error = await expectErrorResponse(response);
    expect(error.errors).includes("ResourceAccessDeniedError");
  });

  it("prevents data tail", async ({ expect }) => {
    const response = await organizationB.tailData({
      schema: schema.id,
    });

    const error = await expectErrorResponse(response);
    expect(error.errors).includes("ResourceAccessDeniedError");
  });
});
