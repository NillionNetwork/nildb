import { faker } from "@faker-js/faker";
import { describe } from "vitest";
import { createUuidDto, type UuidDto } from "#/common/types";
import { TAIL_DATA_LIMIT } from "#/data/data.repository";
import { Permissions } from "#/users/users.types";
import queryJson from "./data/simple.query.json";
import schemaJson from "./data/simple.schema.json";
import type { QueryFixture, SchemaFixture } from "./fixture/fixture";
import { createTestFixtureExtension } from "./fixture/it";

describe("read data", () => {
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
  const testData: Record[] = Array.from({ length: collectionSize }, () => ({
    _id: createUuidDto(),
    name: faker.person.fullName(),
  }));

  beforeAll(async (c) => {
    const { builder, user } = c;

    await builder
      .uploadOwnedData(c, {
        userId: user.did,
        collection: schema.id,
        data: testData,
        permissions: new Permissions(builder.did, {
          read: true,
          write: false,
          execute: false,
        }),
      })
      .expectSuccess();
  });

  afterAll(async (_c) => {});

  it("can tail a collection", async ({ c }) => {
    const { expect, builder } = c;

    const result = await builder
      .tailData(c, {
        schema: schema.id,
      })
      .expectSuccess();

    expect(result.data).toHaveLength(TAIL_DATA_LIMIT);
  });

  it("can read data from a collection", async ({ c }) => {
    const { expect, builder } = c;

    const testRecord = testData[Math.floor(Math.random() * collectionSize)];

    const result = await builder
      .readData(c, {
        schema: schema.id,
        filter: { name: testRecord.name },
      })
      .expectSuccess();

    expect(result.data).toHaveLength(1);
    expect(result.data[0]?._id).toBe(testRecord._id);
    expect(result.data[0]?.name).toBe(testRecord.name);
  });
});
