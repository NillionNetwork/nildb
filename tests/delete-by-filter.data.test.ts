import { faker } from "@faker-js/faker";
import { StatusCodes } from "http-status-codes";
import { describe } from "vitest";
import { createUuidDto, type UuidDto } from "#/common/types";
import collectionJson from "./data/simple.collection.json";
import queryJson from "./data/simple.query.json";
import { assertDocumentCount } from "./fixture/assertions";
import type { CollectionFixture, QueryFixture } from "./fixture/fixture";
import { createTestFixtureExtension } from "./fixture/it";

describe("delete-by-filter.data.test.ts", () => {
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

  const data: Record[] = Array.from({ length: collectionSize - 3 }, () => ({
    _id: createUuidDto(),
    name: faker.person.fullName(),
  }));

  beforeAll(async (c) => {
    data.push({ _id: createUuidDto(), name: "foo" });
    data.push({ _id: createUuidDto(), name: "bar" });
    data.push({ _id: createUuidDto(), name: "bar" });

    const shuffledData = [...data].sort(() => Math.random() - 0.5);

    const { builder, user } = c;

    await builder
      .createOwnedData(c, {
        owner: user.did.didString,
        collection: collection.id,
        acl: {
          grantee: builder.did.didString,
          read: true,
          write: false,
          execute: false,
        },
        data: shuffledData,
      })
      .expectSuccess();
  });

  afterAll(async (_c) => {});

  it("rejects empty filter", async ({ c }) => {
    const { builder } = c;

    await builder
      .deleteData(c, {
        collection: collection.id,
        filter: {},
      })
      .expectFailure(StatusCodes.BAD_REQUEST);
  });

  it("can remove a single match", async ({ c }) => {
    const { builder, expect } = c;

    const result = await builder
      .deleteData(c, {
        collection: collection.id,
        filter: { name: "foo" },
      })
      .expectSuccess();

    expect(result.data.deletedCount).toBe(1);
    await assertDocumentCount(c, collection.id, collectionSize - 1);
  });

  it("can remove multiple matches", async ({ c }) => {
    const { builder, expect } = c;

    const result = await builder
      .deleteData(c, {
        collection: collection.id,
        filter: { name: "bar" },
      })
      .expectSuccess();

    expect(result.data.deletedCount).toBe(2);

    await assertDocumentCount(c, collection.id, collectionSize - 3);
  });
});
