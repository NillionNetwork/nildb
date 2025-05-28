import { faker } from "@faker-js/faker";
import { Keypair, NilauthClient } from "@nillion/nuc";
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
  beforeAll(async (_c) => {});
  afterAll(async (_c) => {});

  it("rejects unauthenticated requests", async ({ c }) => {
    const { app, expect } = c;

    const response = await app.request(PathsV1.accounts.root);
    expect(response.status).toBe(StatusCodes.UNAUTHORIZED);
  });
});

describe("restrict cross-organization operations", () => {
  const schema = schemaJson as unknown as SchemaFixture;
  const query = queryJson as unknown as QueryFixture;
  const { it, beforeAll, afterAll } = createTestFixtureExtension({
    schema,
    query,
  });
  afterAll(async (_c) => {});

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

    const keypair = Keypair.generate();
    const nilauth = await NilauthClient.from({
      keypair,
      payer: organization._options.payer,
      baseUrl: bindings.config.nilauthBaseUrl,
    });

    organizationB = new TestOrganizationUserClient({
      app: app,
      keypair,
      payer: organization._options.payer,
      nilauth,
      node: bindings.node,
    });

    await organizationB.ensureSubscriptionActive();

    await organizationB.register({
      did: organizationB.did,
      name: faker.company.name(),
    });
  });

  it("prevents data upload", async ({ c }) => {
    const { expect } = c;

    const response = await organizationB.uploadData({
      schema: schema.id,
      data: [
        {
          _id: createUuidDto(),
          name: faker.person.fullName(),
        },
      ],
    });

    const error = await expectErrorResponse(c, response);
    expect(error.errors).includes("ResourceAccessDeniedError");
  });

  it("prevents data reads", async ({ c }) => {
    const { expect } = c;

    const response = await organizationB.readData({
      schema: schema.id,
      filter: {},
    });

    const error = await expectErrorResponse(c, response);
    expect(error.errors).includes("ResourceAccessDeniedError");
  });

  it("prevents data updates", async ({ c }) => {
    const { expect } = c;

    const record = data[Math.floor(Math.random() * collectionSize)];
    const response = await organizationB.updateData({
      schema: schema.id,
      filter: { name: record.name },
      update: { name: "foo" },
    });

    const error = await expectErrorResponse(c, response);
    expect(error.errors).includes("ResourceAccessDeniedError");
  });

  it("prevents data deletes", async ({ c }) => {
    const { expect } = c;

    const record = data[Math.floor(Math.random() * collectionSize)];
    const response = await organizationB.deleteData({
      schema: schema.id,
      filter: { name: record.name },
    });

    const error = await expectErrorResponse(c, response);
    expect(error.errors).includes("ResourceAccessDeniedError");
  });

  it("prevents data flush", async ({ c }) => {
    const { expect } = c;

    const response = await organizationB.flushData({
      schema: schema.id,
    });

    const error = await expectErrorResponse(c, response);
    expect(error.errors).includes("ResourceAccessDeniedError");
  });

  it("prevents data tail", async ({ c }) => {
    const { expect } = c;

    const response = await organizationB.tailData({
      schema: schema.id,
    });

    const error = await expectErrorResponse(c, response);
    expect(error.errors).includes("ResourceAccessDeniedError");
  });
});
