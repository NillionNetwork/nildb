import { faker } from "@faker-js/faker";
import { Keypair } from "@nillion/nuc";
import { StatusCodes } from "http-status-codes";
import { describe } from "vitest";
import { createUuidDto } from "#/common/types";
import collectionJson from "./data/simple.collection.json";
import queryJson from "./data/simple.query.json";
import type { CollectionFixture, QueryFixture } from "./fixture/fixture";
import { createTestFixtureExtension } from "./fixture/it";
import {
  type BuilderTestClient,
  createBuilderTestClient,
} from "./fixture/test-client";

describe("access-controls", () => {
  const collection = collectionJson as unknown as CollectionFixture;
  const query = queryJson as unknown as QueryFixture;
  const { it, beforeAll } = createTestFixtureExtension({
    collection,
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
      .createOwnedData(c, {
        owner: user.did.didString,
        collection: collection.id,
        data,
        acl: {
          grantee: builder.did.didString,
          read: true,
          write: false,
          execute: false,
        },
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
        did: builderB.did.didString,
        name: "builderB",
      })
      .expectSuccess();

    await builderB.ensureSubscriptionActive();
  });

  it("prevents data upload", async ({ c }) => {
    const { builder, user } = c;

    await builderB
      .createOwnedData(c, {
        owner: user.did.didString,
        collection: collection.id,
        data: [
          {
            _id: createUuidDto(),
            name: faker.person.fullName(),
          },
        ],
        acl: {
          grantee: builder.did.didString,
          read: true,
          write: false,
          execute: false,
        },
      })
      .expectFailure(StatusCodes.NOT_FOUND, "ResourceAccessDeniedError");
  });

  it("prevents data reads", async ({ c }) => {
    await builderB
      .findData(c, {
        collection: collection.id,
        filter: {},
      })
      .expectFailure(StatusCodes.NOT_FOUND, "ResourceAccessDeniedError");
  });

  it("prevents data updates", async ({ c }) => {
    const record = data[Math.floor(Math.random() * collectionSize)];
    await builderB
      .updateData(c, {
        collection: collection.id,
        filter: { name: record.name },
        update: { name: "foo" },
      })
      .expectFailure(StatusCodes.NOT_FOUND, "ResourceAccessDeniedError");
  });

  it("prevents data deletes", async ({ c }) => {
    const record = data[Math.floor(Math.random() * collectionSize)];

    await builderB
      .deleteData(c, {
        collection: collection.id,
        filter: { name: record.name },
      })
      .expectFailure(StatusCodes.NOT_FOUND, "ResourceAccessDeniedError");
  });

  it("prevents data flush", async ({ c }) => {
    await builderB
      .flushData(c, collection.id)
      .expectFailure(StatusCodes.NOT_FOUND, "ResourceAccessDeniedError");
  });

  it("prevents data tail", async ({ c }) => {
    await builderB
      .tailData(c, collection.id)
      .expectFailure(StatusCodes.NOT_FOUND, "ResourceAccessDeniedError");
  });
});
