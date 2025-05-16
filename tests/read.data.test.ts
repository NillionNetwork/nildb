import { faker } from "@faker-js/faker";
import { describe } from "vitest";
import { createUuidDto, type UuidDto } from "#/common/types";
import { TAIL_DATA_LIMIT } from "#/data/data.repository";
import queryJson from "./data/simple.query.json";
import schemaJson from "./data/simple.schema.json";
import { expectSuccessResponse } from "./fixture/assertions";
import type { QueryFixture, SchemaFixture } from "./fixture/fixture";
import { createTestFixtureExtension } from "./fixture/it";

describe("data reading operations", () => {
  const schema = schemaJson as unknown as SchemaFixture;
  const query = queryJson as unknown as QueryFixture;
  const { it, beforeAll, afterAll } = createTestFixtureExtension({
    schema,
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

  beforeAll(async ({ organization }) => {
    await organization.uploadData({
      schema: schema.id,
      data: testData,
    });
  });

  afterAll(async (_ctx) => {});

  it("can tail a collection", async ({ expect, organization }) => {
    const response = await organization.tailData({
      schema: schema.id,
    });

    const result = await expectSuccessResponse<Record[]>(response);
    expect(result.data).toHaveLength(TAIL_DATA_LIMIT);
  });

  it("can read data from a collection", async ({ expect, organization }) => {
    const testRecord = testData[Math.floor(Math.random() * collectionSize)];

    const response = await organization.readData({
      schema: schema.id,
      filter: { name: testRecord.name },
    });

    const result = await expectSuccessResponse<Record[]>(response);
    expect(result.data).toHaveLength(1);
    expect(result.data[0]?._id).toBe(testRecord._id);
    expect(result.data[0]?.name).toBe(testRecord.name);
  });
});
