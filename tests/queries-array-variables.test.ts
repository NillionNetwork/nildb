import { faker } from "@faker-js/faker";
import { describe } from "vitest";
import { createUuidDto, type UuidDto } from "#/common/types";
import queryJson from "./data/variables.array.query.json";
import schemaJson from "./data/variables.array.schema.json";
import {
  expectErrorResponse,
  expectSuccessResponse,
} from "./fixture/assertions";
import type { QueryFixture, SchemaFixture } from "./fixture/fixture";
import { createTestFixtureExtension } from "./fixture/it";

describe("array variable queries", () => {
  const schema = schemaJson as unknown as SchemaFixture;
  const query = queryJson as unknown as QueryFixture;
  const { it, beforeAll, afterAll } = createTestFixtureExtension({
    schema,
    query,
  });

  type Record = {
    _id: UuidDto;
    values: number[];
  };

  const data: Record[] = Array.from({ length: 10 }, () => ({
    _id: createUuidDto(),
    values: [faker.number.int(), faker.number.int(), faker.number.int()],
  }));

  beforeAll(async ({ organization }) => {
    await organization.uploadData({
      schema: schema.id,
      data,
    });
  });

  afterAll(async (_ctx) => {});

  it("rejects mixed-type arrays", async ({ expect, organization }) => {
    const variables = {
      values: [1, "string"],
    };

    const response = await organization.executeQuery({
      id: query.id,
      variables,
    });

    const error = await expectErrorResponse(response);
    expect(error.errors).includes("DataValidationError");
  });

  it("can execute with empty array", async ({ expect, organization }) => {
    const variables = {
      values: [],
    };

    const response = await organization.executeQuery({
      id: query.id,
      variables,
    });

    const result = await expectSuccessResponse<unknown[]>(response);
    expect(result.data).toHaveLength(0);
  });

  it("can use valid array of variables in pipeline", async ({
    expect,
    organization,
  }) => {
    const testRecord = data[2];
    const variables = {
      values: testRecord.values,
    };

    const response = await organization.executeQuery({
      id: query.id,
      variables,
    });

    const result = await expectSuccessResponse<unknown[]>(response);
    expect(result.data).toHaveLength(1);
  });
});
