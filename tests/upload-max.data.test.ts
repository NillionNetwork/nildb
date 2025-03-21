import { describe } from "vitest";
import { type UuidDto, createUuidDto } from "#/common/types";
import type { UploadResult } from "#/data/data.repository";
import { MAX_RECORDS_LENGTH } from "#/data/data.types";
import queryJson from "./data/simple.query.json";
import schemaJson from "./data/simple.schema.json";
import {
  expectErrorResponse,
  expectSuccessResponse,
} from "./fixture/assertions";
import type { QueryFixture, SchemaFixture } from "./fixture/fixture";
import { createTestFixtureExtension } from "./fixture/it";

describe("upload.max.data.test", () => {
  const schema = schemaJson as unknown as SchemaFixture;
  const query = queryJson as unknown as QueryFixture;
  const { it, beforeAll, afterAll } = createTestFixtureExtension({
    schema,
    query,
  });
  beforeAll(async (_ctx) => {});
  afterAll(async (_ctx) => {});

  type Record = {
    _id: UuidDto;
    name: string;
  };
  const nextDocument: () => Record = () => ({
    _id: createUuidDto(),
    // insufficient unique full names in faker so using uuids
    name: createUuidDto(),
  });

  it("rejects payload that exceeds MAX_RECORDS_LENGTH", async ({
    expect,
    organization,
  }) => {
    const data: Record[] = Array.from({ length: MAX_RECORDS_LENGTH + 1 }, () =>
      nextDocument(),
    );

    const response = await organization.uploadData({
      schema: schema.id,
      data,
    });

    const result = await expectErrorResponse(response);
    expect(result.errors).toContain(
      'Length must be non zero and lte 10000 at "data"',
    );
  });

  it("accepts payload at MAX_RECORDS_LENGTH", async ({
    expect,
    organization,
  }) => {
    const data: Record[] = Array.from({ length: MAX_RECORDS_LENGTH }, () =>
      nextDocument(),
    );

    const response = await organization.uploadData({
      schema: schema.id,
      data,
    });

    const result = await expectSuccessResponse<UploadResult>(response);
    expect(result.data.errors).toHaveLength(0);
    expect(result.data.created).toHaveLength(MAX_RECORDS_LENGTH);
  });
});
