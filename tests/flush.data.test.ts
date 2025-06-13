import { faker } from "@faker-js/faker";
import { describe } from "vitest";
import { createUuidDto, type UuidDto } from "#/common/types";
import collectionJson from "./data/simple.collection.json";
import queryJson from "./data/simple.query.json";
import { assertDocumentCount } from "./fixture/assertions";
import type { CollectionFixture, QueryFixture } from "./fixture/fixture";
import { createTestFixtureExtension } from "./fixture/it";

describe("flush.data.test.ts", () => {
  const collection = collectionJson as unknown as CollectionFixture;
  const query = queryJson as unknown as QueryFixture;
  const { it, beforeAll, afterAll } = createTestFixtureExtension({
    collection,
    query,
  });

  const collectionSize = 100;
  type Record = {
    _id: UuidDto;
    name: string;
  };
  const data: Record[] = Array.from({ length: collectionSize }, () => ({
    _id: createUuidDto(),
    name: faker.person.fullName(),
  }));

  beforeAll(async (c) => {
    const { builder, user } = c;

    await builder
      .createOwnedData(c, {
        owner: user.did,
        collection: collection.id,
        data,
        acl: { grantee: builder.did, read: true, write: false, execute: false },
      })
      .expectSuccess();
  });

  afterAll(async (_c) => {});

  it("can flush a collection", async ({ c }) => {
    const { builder } = c;

    await assertDocumentCount(c, collection.id, collectionSize);
    await builder.flushData(c, collection.id).expectSuccess();
    await assertDocumentCount(c, collection.id, 0);
  });
});
