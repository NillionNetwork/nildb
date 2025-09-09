import { faker } from "@faker-js/faker";
import { describe } from "vitest";
import { createUuidDto, type UuidDto } from "#/common/types";
import type { OwnedDocumentBase } from "#/data/data.types";
import collectionJson from "./data/simple.collection.json";
import queryJson from "./data/simple.query.json";
import { assertDefined } from "./fixture/assertions";
import type { CollectionFixture, QueryFixture } from "./fixture/fixture";
import { createTestFixtureExtension } from "./fixture/it";

describe("update data", () => {
  const collection = collectionJson as unknown as CollectionFixture;
  const query = queryJson as unknown as QueryFixture;
  const { it, beforeAll, afterAll } = createTestFixtureExtension({
    collection: collection,
    query,
  });
  type Record = {
    _id: UuidDto;
    name: string;
  };
  const collectionSize = 100;
  const data: Record[] = Array.from({ length: collectionSize }, () => ({
    _id: createUuidDto(),
    name: faker.person.fullName(),
  }));

  beforeAll(async (c) => {
    const { builder, user } = c;

    await builder
      .createOwnedData(c, {
        owner: user.did.didString,
        collection: collection.id,
        data,
        acl: {
          grantee: builder.did.didString,
          read: true,
          write: true,
          execute: false,
        },
      })
      .expectSuccess();
  });

  afterAll(async (_c) => {});

  it("can update data in a collection", async ({ c }) => {
    const { expect, bindings, builder } = c;

    const record = data[Math.floor(Math.random() * collectionSize)];

    const filter = { name: record.name };
    const update = { $set: { name: "foo" } };
    const response = await builder
      .updateData(c, {
        collection: collection.id,
        filter,
        update,
      })
      .expectSuccess();

    expect(response.data.modified).toBe(1);
    expect(response.data.matched).toBe(1);

    const actual = await bindings.db.data
      .collection<OwnedDocumentBase>(collection.id.toString())
      .findOne({ name: "foo" });

    assertDefined(c, actual);
    expect(actual._id.toString()).toBe(record._id);
  });
});
