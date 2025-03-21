import { faker } from "@faker-js/faker";
import type { DeleteResult } from "mongodb";
import { describe } from "vitest";
import { type UuidDto, createUuidDto } from "#/common/types";
import queryJson from "./data/simple.query.json";
import schemaJson from "./data/simple.schema.json";
import {
  expectErrorResponse,
  expectSuccessResponse,
} from "./fixture/assertions";
import type { QueryFixture, SchemaFixture } from "./fixture/fixture";
import { createTestFixtureExtension } from "./fixture/it";

describe("schema data deletion", () => {
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
      schema: schema.id,
      data: shuffledData,
    });
  });

  afterAll(async (_ctx) => {});

  it("rejects empty filter", async ({ expect, organization }) => {
    const filter = {};

    const response = await organization.deleteData({
      schema: schema.id,
      filter,
    });

    const result = await expectErrorResponse(response);
    expect(result.errors).toContain('Filter cannot be empty at "filter"');
  });

  it("can remove a single match", async ({
    expect,
    bindings,
    organization,
  }) => {
    const filter = { name: "foo" };

    const response = await organization.deleteData({
      schema: schema.id,
      filter,
    });

    const result = await expectSuccessResponse<DeleteResult>(response);
    expect(result.data.deletedCount).toBe(1);

    const count = await bindings.db.data
      .collection(schema.id.toString())
      .countDocuments();
    expect(count).toBe(collectionSize - 1);
  });

  it("can remove multiple matches", async ({
    expect,
    bindings,
    organization,
  }) => {
    const filter = { name: "bar" };

    const response = await organization.deleteData({
      schema: schema.id,
      filter,
    });

    const result = await expectSuccessResponse<DeleteResult>(response);
    expect(result.data.deletedCount).toBe(2);

    const count = await bindings.db.data
      .collection(schema.id.toString())
      .countDocuments();
    expect(count).toBe(collectionSize - 3);
  });
});
