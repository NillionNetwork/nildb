import { faker } from "@faker-js/faker";
import { describe } from "vitest";
import { createUuidDto, type UuidDto } from "#/common/types";
import type { DataDocument } from "#/data/data.repository";
import { Permissions } from "#/users/users.types";
import queryJson from "./data/simple.query.json";
import schemaJson from "./data/simple.schema.json";
import { assertDefined } from "./fixture/assertions";
import type { QueryFixture, SchemaFixture } from "./fixture/fixture";
import { createTestFixtureExtension } from "./fixture/it";

describe("update data", () => {
  const schema = schemaJson as unknown as SchemaFixture;
  const query = queryJson as unknown as QueryFixture;
  const { it, beforeAll, afterAll } = createTestFixtureExtension({
    collection: schema,
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
      .uploadOwnedData(c, {
        userId: user.did,
        collection: schema.id,
        data,
        permissions: new Permissions(builder.did, {
          read: true,
          write: false,
          execute: false,
        }),
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
        collection: schema.id,
        filter,
        update,
      })
      .expectSuccess();

    expect(response.data.modifiedCount).toBe(1);
    expect(response.data.matchedCount).toBe(1);

    const actual = await bindings.db.data
      .collection<DataDocument>(schema.id.toString())
      .findOne({ name: "foo" });

    assertDefined(c, actual);
    expect(actual._id.toString()).toBe(record._id);
  });
});
