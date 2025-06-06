import { faker } from "@faker-js/faker";
import { StatusCodes } from "http-status-codes";
import { describe } from "vitest";
import { createUuidDto, type UuidDto } from "#/common/types";
import { Permissions } from "#/user/user.types";
import queryJson from "./data/variables.array.query.json";
import schemaJson from "./data/variables.array.schema.json";
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

  beforeAll(async (c) => {
    const { builder, user } = c;

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
      .expectSuccess();
  });

  afterAll(async (_c) => {});

  it("rejects mixed-type arrays", async ({ c }) => {
    const { builder } = c;

    const variables = {
      values: [1, "string"],
    };

    await builder
      .executeQuery(c, {
        id: query.id,
        variables,
      })
      .expectFailure(StatusCodes.BAD_REQUEST, "DataValidationError");
  });

  it("can execute with empty array", async ({ c }) => {
    const { expect, builder } = c;

    const variables = {
      values: [],
    };

    const result = await builder
      .executeQuery(c, {
        id: query.id,
        variables,
      })
      .expectSuccess();

    expect(result.data).toHaveLength(0);
  });

  it("can use valid array of variables in pipeline", async ({ c }) => {
    const { expect, builder } = c;

    const testRecord = data[2];
    const variables = {
      values: testRecord.values,
    };

    const result = await builder
      .executeQuery(c, {
        id: query.id,
        variables,
      })
      .expectSuccess();

    expect(result.data).toHaveLength(1);
  });
});
