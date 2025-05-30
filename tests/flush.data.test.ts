import { faker } from "@faker-js/faker";
import type { DeleteResult } from "mongodb";
import { describe } from "vitest";
import { createUuidDto, type UuidDto } from "#/common/types";
import queryJson from "./data/simple.query.json";
import schemaJson from "./data/simple.schema.json";
import {
  assertDocumentCount,
  expectSuccessResponse,
} from "./fixture/assertions";
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

  beforeAll(async (c) => {
    const _response = await c.organization.uploadData({
      schema: schema.id,
      data,
    });
  });

  afterAll(async (_c) => {});

  it("can flush a collection", async ({ c }) => {
    const { expect, organization } = c;

    await assertDocumentCount(c, schema.id, collectionSize);

    const response = await organization.flushData({
      schema: schema.id,
    });

    const result = await expectSuccessResponse<DeleteResult>(c, response);

    expect(result.data.deletedCount).toBe(collectionSize);
    await assertDocumentCount(c, schema.id, 0);
  });
});
