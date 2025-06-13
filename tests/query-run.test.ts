import { faker } from "@faker-js/faker";
import { describe } from "vitest";
import { createUuidDto, type UuidDto } from "#/common/types";
import collectioJson from "./data/wallet.collection.json";
import queryJson from "./data/wallet.query.json";
import { waitForQueryRun } from "./fixture/assertions";
import type { CollectionFixture, QueryFixture } from "./fixture/fixture";
import { createTestFixtureExtension } from "./fixture/it";

describe("query-run.test.ts", () => {
  let runId: UuidDto;
  const collection = collectioJson as unknown as CollectionFixture;
  const query = queryJson as unknown as QueryFixture;

  const { it, beforeAll, afterAll } = createTestFixtureExtension({
    collection,
    query,
  });

  type Record = {
    _id: UuidDto;
    wallet: string;
    age: number;
    country: string;
  };

  beforeAll(async (c) => {
    const data: Record[] = Array.from({ length: 10 }, () => ({
      _id: createUuidDto(),
      wallet: faker.finance.ethereumAddress(),
      age: faker.number.int({ min: 100, max: 1000 }),
      country: faker.location.countryCode(),
    }));

    const { builder, user } = c;

    await builder
      .createOwnedData(c, {
        owner: user.did,
        collection: collection.id,
        acl: { grantee: builder.did, read: true, write: false, execute: true },
        data,
      })
      .expectSuccess();
  });

  afterAll(async (_c) => {});

  it("can start a long-running job", async ({ c }) => {
    const { expect, builder } = c;

    const result = await builder
      .runQuery(c, {
        _id: query.id,
        variables: {},
      })
      .expectSuccess();

    runId = result.data as UuidDto;
    expect(runId).toBeDefined();
  });

  it("can poll for a job result", async ({ c }) => {
    const { expect } = c;

    const result = await waitForQueryRun(c, runId);

    expect(result.data.status).toBe("complete");
    expect(result.data.result).toHaveLength(1);
    const data = result.data.result as {
      averageAge: number;
      count: number;
    }[];

    expect(data.at(0)).toHaveProperty("averageAge");
    expect(data.at(0)).toHaveProperty("count");
  });
});
