import { faker } from "@faker-js/faker";
import { describe } from "vitest";
import { createUuidDto, type UuidDto } from "#/common/types";
import collectionJson from "./data/simple.collection.json";
import queryJson from "./data/simple.query.json";
import type { CollectionFixture, QueryFixture } from "./fixture/fixture";
import { createTestFixtureExtension } from "./fixture/it";

describe("read.data.test.ts", () => {
  const collection = collectionJson as unknown as CollectionFixture;
  const query = queryJson as unknown as QueryFixture;
  const { it, beforeAll, afterAll } = createTestFixtureExtension({
    collection,
    query,
  });

  type Record = {
    _id: UuidDto;
    name: string;
  };

  const collectionSize = 100;
  const testData: Record[] = Array.from({ length: collectionSize }, () => ({
    _id: createUuidDto(),
    name: faker.person.fullName(),
  }));

  beforeAll(async (c) => {
    const { builder, user } = c;

    await builder
      .createOwnedData(c, {
        owner: user.did,
        collection: collection.id,
        data: testData,
        acl: { grantee: builder.did, read: true, write: false, execute: false },
      })
      .expectSuccess();
  });

  afterAll(async (_c) => {});

  it("can tail a collection", async ({ c }) => {
    const { expect, builder } = c;

    const limit = 50;
    const result = await builder
      .tailData(c, collection.id, limit)
      .expectSuccess();

    expect(result.data).toHaveLength(limit);
  });

  it("can read data from a collection", async ({ c }) => {
    const { expect, builder } = c;

    const testRecord = testData[Math.floor(Math.random() * collectionSize)];

    const result = await builder
      .findData(c, {
        collection: collection.id,
        filter: { name: testRecord.name },
      })
      .expectSuccess();

    expect(result.data).toHaveLength(1);
    expect(result.data[0]?._id).toBe(testRecord._id);
    expect(result.data[0]?.name).toBe(testRecord.name);
  });
});
