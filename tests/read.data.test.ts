import { faker } from "@faker-js/faker";
import { Keypair } from "@nillion/nuc";
import { describe } from "vitest";
import { createUuidDto, type UuidDto } from "#/common/types";
import { TAIL_DATA_LIMIT } from "#/data/data.repository";
import { Permissions } from "#/user/user.types";
import queryJson from "./data/simple.query.json";
import schemaJson from "./data/simple.schema.json";
import { expectSuccessResponse } from "./fixture/assertions";
import type { QueryFixture, SchemaFixture } from "./fixture/fixture";
import { createTestFixtureExtension } from "./fixture/it";

describe("data reading operations", () => {
  const userId = Keypair.generate().toDidString();
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
      userId,
      schema: schema.id,
      data: testData,
      permissions: new Permissions(organization.did, {
        read: true,
        write: false,
        execute: false,
      }),
    });
  });

  afterAll(async (_c) => {});

  it("can tail a collection", async ({ c }) => {
    const { expect, organization } = c;

    const response = await organization.tailData({
      schema: schema.id,
    });

    const result = await expectSuccessResponse<Record[]>(c, response);
    expect(result.data).toHaveLength(TAIL_DATA_LIMIT);
  });

  it("can read data from a collection", async ({ c }) => {
    const { expect, organization } = c;

    const testRecord = testData[Math.floor(Math.random() * collectionSize)];

    const response = await organization.readData({
      schema: schema.id,
      filter: { name: testRecord.name },
    });

    const result = await expectSuccessResponse<Record[]>(c, response);
    expect(result.data).toHaveLength(1);
    expect(result.data[0]?._id).toBe(testRecord._id);
    expect(result.data[0]?.name).toBe(testRecord.name);
  });
});
