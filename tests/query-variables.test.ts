import { faker } from "@faker-js/faker";
import { describe } from "vitest";
import { createUuidDto, type UuidDto } from "#/common/types";
import collectionJson from "./data/variables.wallet.collection.json";
import queryJson from "./data/variables.wallet.query.json";
import { waitForQueryRun } from "./fixture/assertions";
import type { CollectionFixture, QueryFixture } from "./fixture/fixture";
import { createTestFixtureExtension } from "./fixture/it";

describe("query-variables.test.ts", () => {
  const collection = collectionJson as unknown as CollectionFixture;
  const query = queryJson as unknown as QueryFixture;
  const { it, beforeAll, afterAll } = createTestFixtureExtension({
    collection,
    query,
  });

  type Record = {
    _id: UuidDto;
    wallet: string;
    amount: number;
    status: "pending" | "completed" | "failed";
    timestamp: string;
  };

  type QueryResult = {
    _id: string;
    totalAmount: number;
    count: number;
  };

  // Use a deterministic start date to avoid test flakiness so that data generation and
  // the query filter operate against a shared time reference
  const startDate = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 hours ago

  beforeAll(async (c) => {
    const data: Record[] = Array.from({ length: 10 }, () => ({
      _id: createUuidDto(),
      wallet: faker.finance.ethereumAddress(),
      amount: faker.number.int({ min: 100, max: 1000 }),
      status: faker.helpers.arrayElement(["pending", "completed", "failed"]),
      timestamp: faker.date
        .between({ from: startDate, to: new Date() })
        .toISOString(),
    }));

    // Manually add at least one record to match the query variables to ensure the job's
    // result is not empty (otherwise the test is flakey). The element status must be both
    // "complete" and the timestamp > startDate
    data.push({
      _id: createUuidDto(),
      wallet: faker.finance.ethereumAddress(),
      amount: 750,
      status: "completed",
      timestamp: new Date(startDate.getTime() + 1000).toISOString(),
    });

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

  it("can execute query with variables", async ({ c }) => {
    const { expect, builder } = c;

    const variables = {
      minAmount: 500,
      status: "completed",
      // use the shared start date to ensure there is at least one record in the result
      startDate: startDate.toISOString(),
      $coerce: {
        startDate: "date",
      },
    };

    const runId = (
      await builder
        .runQuery(c, {
          _id: query.id,
          variables,
        })
        .expectSuccess()
    ).data as UuidDto;

    const { data } = await waitForQueryRun(c, runId);
    expect(data.status).toBe("complete");
    const [result] = data.result as [QueryResult];

    expect(result.totalAmount).toBeGreaterThanOrEqual(750);
    expect(result.count).toBeGreaterThan(0);
  });

  it("rejects object as variable value", async ({ c }) => {
    const { builder, expect } = c;

    const variables = {
      minAmount: 500,
      status: { value: "completed" },
      startDate: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
      $coerce: {
        startDate: "date",
      },
    };

    const runId = (
      await builder
        .runQuery(c, {
          _id: query.id,
          variables,
        })
        .expectSuccess()
    ).data as UuidDto;

    const { data } = await waitForQueryRun(c, runId);

    expect(data.status).toBe("error");
    expect(data.result).toBeDefined();

    const errors = data.errors!;
    expect(errors.at(0)).toMatch("DataValidationError");
  });

  it("rejects null as variable value", async ({ c }) => {
    const { builder, expect } = c;

    const variables = {
      minAmount: 500,
      status: "completed",
      startDate: null,
      $coerce: {
        startDate: "date",
      },
    };

    const runId = (
      await builder
        .runQuery(c, {
          _id: query.id,
          variables,
        })
        .expectSuccess()
    ).data as UuidDto;

    const { data } = await waitForQueryRun(c, runId);
    expect(data.status).toBe("error");
    expect(data.result).toBeDefined();

    const errors = data.errors!;
    expect(errors.at(0)).toMatch("DataValidationError");
  });

  it("rejects undefined as variable value", async ({ c }) => {
    const { builder, expect } = c;

    const variables = {
      minAmount: 500,
      status: "completed",
      startDate: undefined,
      $coerce: {
        startDate: "date",
      },
    };

    const runId = (
      await builder
        .runQuery(c, {
          _id: query.id,
          variables,
        })
        .expectSuccess()
    ).data as UuidDto;

    const { data } = await waitForQueryRun(c, runId);
    expect(data.status).toBe("error");
    expect(data.result).toBeDefined();

    const errors = data.errors!;
    expect(errors.at(0)).toMatch("DataValidationError");
  });

  it("rejects function as variable value", async ({ c }) => {
    const { builder, expect } = c;

    const variables = {
      minAmount: 500,
      status: "completed",
      startDate: () => new Date().toISOString(),
      $coerce: {
        startDate: "date",
      },
    };
    const runId = (
      await builder
        .runQuery(c, {
          _id: query.id,
          variables,
        })
        .expectSuccess()
    ).data as UuidDto;

    const { data } = await waitForQueryRun(c, runId);
    expect(data.status).toBe("error");
    expect(data.result).toBeDefined();

    const errors = data.errors!;
    expect(errors.at(0)).toMatch("DataValidationError");
  });
});
