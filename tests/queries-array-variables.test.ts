import { faker } from "@faker-js/faker";
import { describe } from "vitest";
import { createUuidDto, type UuidDto } from "#/common/types";
import collectionJson from "./data/variables.array.collection.json";
import queryJson from "./data/variables.array.query.json";
import { waitForQueryRun } from "./fixture/assertions";
import type { CollectionFixture, QueryFixture } from "./fixture/fixture";
import { createTestFixtureExtension } from "./fixture/it";

describe("queries-array-variables.test.ts", () => {
  const collection = collectionJson as unknown as CollectionFixture;
  const query = queryJson as unknown as QueryFixture;
  const { it, beforeAll, afterAll } = createTestFixtureExtension({
    collection,
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
      .createOwnedData(c, {
        owner: user.did,
        collection: collection.id,
        data,
        acl: { grantee: builder.did, read: false, write: false, execute: true },
      })
      .expectSuccess();
  });

  afterAll(async (_c) => {});

  it("rejects mixed-type arrays", async ({ c }) => {
    const { builder, expect } = c;

    const variables = {
      values: [1, "string"],
    };

    const runId = (
      await builder
        .runQuery(c, {
          _id: query.id,
          variables,
        })
        .expectSuccess()
    ).data as UuidDto;

    const result = await waitForQueryRun(c, runId);
    expect(result.data.errors?.at(0)).toMatch("DataValidationError");
  });

  it("can execute with empty array", async ({ c }) => {
    const { expect, builder } = c;

    const variables = {
      values: [],
    };

    const runId = (
      await builder
        .runQuery(c, {
          _id: query.id,
          variables,
        })
        .expectSuccess()
    ).data as UuidDto;

    const result = await waitForQueryRun(c, runId);
    expect(result.data.result).toHaveLength(0);
  });

  it("can use valid array of variables in pipeline", async ({ c }) => {
    const { expect, builder } = c;

    const testRecord = data[2];
    const variables = {
      values: testRecord.values,
    };

    const runId = (
      await builder
        .runQuery(c, {
          _id: query.id,
          variables,
        })
        .expectSuccess()
    ).data as UuidDto;

    const result = await waitForQueryRun(c, runId);
    expect(result.data.result).toHaveLength(1);
  });
});
