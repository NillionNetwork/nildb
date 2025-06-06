import { StatusCodes } from "http-status-codes";
import { describe } from "vitest";
import { createUuidDto, type UuidDto } from "#/common/types";
import { MAX_RECORDS_LENGTH } from "#/data/data.dto";
import { Permissions } from "#/user/user.types";
import queryJson from "./data/simple.query.json";
import schemaJson from "./data/simple.schema.json";
import type { QueryFixture, SchemaFixture } from "./fixture/fixture";
import { createTestFixtureExtension } from "./fixture/it";

describe("upload max data", () => {
  const schema = schemaJson as unknown as SchemaFixture;
  const query = queryJson as unknown as QueryFixture;
  const { it, beforeAll, afterAll } = createTestFixtureExtension({
    schema,
    query,
  });
  beforeAll(async (_c) => {});
  afterAll(async (_c) => {});

  type Record = {
    _id: UuidDto;
    name: string;
  };
  const nextDocument: () => Record = () => ({
    _id: createUuidDto(),
    // insufficient unique full names in faker so using uuids
    name: createUuidDto(),
  });

  it("rejects payload that exceeds MAX_RECORDS_LENGTH", async ({ c }) => {
    const { builder, user } = c;

    const data: Record[] = Array.from({ length: MAX_RECORDS_LENGTH + 1 }, () =>
      nextDocument(),
    );

    await builder
      .uploadData(c, {
        userId: user.did,
        schema: schema.id,
        data,
        permissions: new Permissions(builder.did, {
          read: true,
          write: false,
          execute: false,
        }),
      })
      .expectFailure(
        StatusCodes.BAD_REQUEST,
        // TODO: disabled until we correctly unpack the zod error message
        // 'Length must be non zero and lte 10000 at "data"',
      );
  });

  it("accepts payload at MAX_RECORDS_LENGTH", async ({ c }) => {
    const { expect, builder, user } = c;

    const data: Record[] = Array.from({ length: MAX_RECORDS_LENGTH }, () =>
      nextDocument(),
    );

    const response = await builder
      .uploadData(c, {
        userId: user.did,
        schema: schema.id,
        data,
        permissions: new Permissions(builder.did, {
          read: true,
          write: false,
          execute: false,
        }),
      })
      .expectSuccess();

    expect(response.data.errors).toHaveLength(0);
    expect(response.data.created).toHaveLength(MAX_RECORDS_LENGTH);
  });
});
