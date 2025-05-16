import { faker } from "@faker-js/faker";
import type { DeleteResult } from "mongodb";
import { describe } from "vitest";
import { createUuidDto, type UuidDto } from "#/common/types";
import queryJson from "./data/simple.query.json";
import schemaJson from "./data/simple.schema.json";
import { expectSuccessResponse } from "./fixture/assertions";
import type { QueryFixture, SchemaFixture } from "./fixture/fixture";
import { createTestFixtureExtension } from "./fixture/it";

describe("flush data collection", () => {
  const schema = schemaJson as unknown as SchemaFixture;
  const query = queryJson as unknown as QueryFixture;
  const { it, beforeAll, afterAll } = createTestFixtureExtension({
    schema,
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

  beforeAll(async ({ organization }) => {
    const response = await organization.uploadData({
      schema: schema.id,
      data,
    });

    await expectSuccessResponse(response);
  });

  afterAll(async (_ctx) => {});

  it("can flush a collection", async ({ expect, bindings, organization }) => {
    const response = await organization.flushData({
      schema: schema.id,
    });

    const result = await expectSuccessResponse<DeleteResult>(response);
    expect(result.data.deletedCount).toBe(collectionSize);

    const count = await bindings.db.data
      .collection(schema.id.toString())
      .countDocuments();
    expect(count).toBe(0);
  });
});
