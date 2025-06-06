import { faker } from "@faker-js/faker";
import { Keypair } from "@nillion/nuc";
import { StatusCodes } from "http-status-codes";
import { describe } from "vitest";
import { createUuidDto } from "#/common/types";
import { Permissions } from "#/user/user.types";
import queryJson from "./data/simple.query.json";
import schemaJson from "./data/simple.schema.json";
import type { QueryFixture, SchemaFixture } from "./fixture/fixture";
import { createTestFixtureExtension } from "./fixture/it";
import {
  type BuilderTestClient,
  createBuilderTestClient,
} from "./fixture/test-client";

// TODO(tim): revisit once we start enforcing Nuc policies
describe("access-controls", () => {
  const schema = schemaJson as unknown as SchemaFixture;
  const query = queryJson as unknown as QueryFixture;
  const { it, beforeAll } = createTestFixtureExtension({
    schema,
    query,
  });

  const collectionSize = 10;
  const data = Array.from({ length: collectionSize }, () => ({
    _id: createUuidDto(),
    name: faker.person.fullName(),
  }));

  let builderB: BuilderTestClient;

  beforeAll(async (c) => {
    const { builder, bindings, app, user } = c;

    await builder
      .uploadData(c, {
        userId: user.did,
        schema: schema.id,
        data,
        permissions: new Permissions(builder.did, {
          read: true,
          write: false,
          execute: false,
        }),
      })
      .expectSuccess();

    builderB = await createBuilderTestClient({
      app,
      keypair: Keypair.from(process.env.APP_NILCHAIN_PRIVATE_KEY_1!),
      chainUrl: process.env.APP_NILCHAIN_JSON_RPC!,
      nilauthBaseUrl: bindings.config.nilauthBaseUrl,
      nodePublicKey: builder._options.nodePublicKey,
    });

    await builderB
      .register(c, {
        did: builderB.did,
        name: "builderB",
      })
      .expectSuccess();

    await builderB.ensureSubscriptionActive();
  });

  it("prevents data upload", async ({ c }) => {
    const { builder, user } = c;

    await builderB
      .uploadData(c, {
        userId: user.did,
        schema: schema.id,
        data: [
          {
            _id: createUuidDto(),
            name: faker.person.fullName(),
          },
        ],
        permissions: new Permissions(builder.did, {
          read: true,
          write: false,
          execute: false,
        }),
      })
      .expectFailure(StatusCodes.NOT_FOUND, "ResourceAccessDeniedError");
  });

  it("prevents data reads", async ({ c }) => {
    await builderB
      .readData(c, {
        schema: schema.id,
        filter: {},
      })
      .expectFailure(StatusCodes.NOT_FOUND, "ResourceAccessDeniedError");
  });

  it("prevents data updates", async ({ c }) => {
    const record = data[Math.floor(Math.random() * collectionSize)];
    await builderB
      .updateData(c, {
        schema: schema.id,
        filter: { name: record.name },
        update: { name: "foo" },
      })
      .expectFailure(StatusCodes.NOT_FOUND, "ResourceAccessDeniedError");
  });

  it("prevents data deletes", async ({ c }) => {
    const record = data[Math.floor(Math.random() * collectionSize)];

    await builderB
      .deleteData(c, {
        schema: schema.id,
        filter: { name: record.name },
      })
      .expectFailure(StatusCodes.NOT_FOUND, "ResourceAccessDeniedError");
  });

  it("prevents data flush", async ({ c }) => {
    await builderB
      .flushData(c, {
        schema: schema.id,
      })
      .expectFailure(StatusCodes.NOT_FOUND, "ResourceAccessDeniedError");
  });

  it("prevents data tail", async ({ c }) => {
    await builderB
      .tailData(c, {
        schema: schema.id,
      })
      .expectFailure(StatusCodes.NOT_FOUND, "ResourceAccessDeniedError");
  });
});
