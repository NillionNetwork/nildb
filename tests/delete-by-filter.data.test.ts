import { faker } from "@faker-js/faker";
import { Keypair } from "@nillion/nuc";
import type { DeleteResult } from "mongodb";
import { describe } from "vitest";
import { createUuidDto, type UuidDto } from "#/common/types";
import queryJson from "./data/simple.query.json";
import schemaJson from "./data/simple.schema.json";
import {
  assertDocumentCount,
  expectErrorResponse,
  expectSuccessResponse,
} from "./fixture/assertions";
import type { QueryFixture, SchemaFixture } from "./fixture/fixture";
import { createTestFixtureExtension } from "./fixture/it";

describe("schema data deletion", () => {
  const userId = Keypair.generate().toDidString();
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
  const data: Record[] = Array.from({ length: collectionSize - 3 }, () => ({
    _id: createUuidDto(),
    name: faker.person.fullName(),
  }));

  beforeAll(async ({ organization }) => {
    data.push({ _id: createUuidDto(), name: "foo" });
    data.push({ _id: createUuidDto(), name: "bar" });
    data.push({ _id: createUuidDto(), name: "bar" });

    const shuffledData = [...data].sort(() => Math.random() - 0.5);

    await organization.uploadData({
      userId,
      schema: schema.id,
      data: shuffledData,
    });
  });

  afterAll(async (_c) => {});

  it("rejects empty filter", async ({ c }) => {
    const { organization, expect } = c;

    const response = await organization.deleteData({
      schema: schema.id,
      filter: {},
    });

    const result = await expectErrorResponse(c, response);
    expect(result.errors).toContain('Filter cannot be empty at "filter"');
  });

  it("can remove a single match", async ({ c }) => {
    const { organization, expect } = c;

    const response = await organization.deleteData({
      schema: schema.id,
      filter: { name: "foo" },
    });

    const result = await expectSuccessResponse<DeleteResult>(c, response);
    expect(result.data.deletedCount).toBe(1);
    await assertDocumentCount(c, schema.id, collectionSize - 1);
  });

  it("can remove multiple matches", async ({ c }) => {
    const { organization, expect } = c;

    const response = await organization.deleteData({
      schema: schema.id,
      filter: { name: "bar" },
    });

    const result = await expectSuccessResponse<DeleteResult>(c, response);
    expect(result.data.deletedCount).toBe(2);

    await assertDocumentCount(c, schema.id, collectionSize - 3);
  });
});
