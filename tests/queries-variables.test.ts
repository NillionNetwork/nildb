import { faker } from "@faker-js/faker";
import { describe } from "vitest";
import { createUuidDto, type UuidDto } from "#/common/types";
import queryJson from "./data/variables.wallet.query.json";
import schemaJson from "./data/variables.wallet.schema.json";
import {
  expectErrorResponse,
  expectSuccessResponse,
} from "./fixture/assertions";
import type { QueryFixture, SchemaFixture } from "./fixture/fixture";
import { createTestFixtureExtension } from "./fixture/it";

describe("query variable validation", () => {
  const schema = schemaJson as unknown as SchemaFixture;
  const query = queryJson as unknown as QueryFixture;
  const { it, beforeAll, afterAll } = createTestFixtureExtension({
    schema,
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

  beforeAll(async (c) => {
    const data: Record[] = Array.from({ length: 10 }, () => ({
      _id: createUuidDto(),
      wallet: faker.finance.ethereumAddress(),
      amount: faker.number.int({ min: 100, max: 1000 }),
      status: faker.helpers.arrayElement(["pending", "completed", "failed"]),
      timestamp: faker.date.recent().toISOString(),
    }));

    const _response = await c.organization.uploadData({
      schema: schema.id,
      data,
    });
  });

  afterAll(async (_c) => {});

  it("can execute query with variables", async ({ c }) => {
    const { expect, organization } = c;

    const variables = {
      minAmount: 500,
      status: "completed",
      startDate: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
      $coerce: {
        startDate: "date",
      },
    };

    const response = await organization.executeQuery({
      id: query.id,
      variables,
    });

    const result = await expectSuccessResponse<QueryResult[]>(c, response);

    for (const record of result.data) {
      expect(record._id).toBe("completed");
      expect(record.totalAmount).toBeGreaterThanOrEqual(500 * record.count);
      expect(record.count).toBeGreaterThan(0);
    }
  });

  it("rejects object as variable value", async ({ c }) => {
    const { expect, organization } = c;

    const variables = {
      minAmount: 500,
      status: { value: "completed" },
      startDate: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
      $coerce: {
        startDate: "date",
      },
    };

    const response = await organization.executeQuery({
      id: query.id,
      variables,
    });

    const error = await expectErrorResponse(c, response);
    expect(error.errors).includes("DataValidationError");
  });

  it("rejects null as variable value", async ({ c }) => {
    const { expect, organization } = c;

    const variables = {
      minAmount: 500,
      status: "completed",
      startDate: null,
      $coerce: {
        startDate: "date",
      },
    };

    const response = await organization.executeQuery({
      id: query.id,
      variables,
    });

    const error = await expectErrorResponse(c, response);
    expect(error.errors).includes("DataValidationError");
  });

  it("rejects undefined as variable value", async ({ c }) => {
    const { expect, organization } = c;

    const variables = {
      minAmount: 500,
      status: "completed",
      startDate: undefined,
      $coerce: {
        startDate: "date",
      },
    };

    const response = await organization.executeQuery({
      id: query.id,
      variables,
    });

    const error = await expectErrorResponse(c, response);
    expect(error.errors).includes("DataValidationError");
  });

  it("rejects function as variable value", async ({ c }) => {
    const { expect, organization } = c;

    const variables = {
      minAmount: 500,
      status: "completed",
      startDate: () => new Date().toISOString(),
      $coerce: {
        startDate: "date",
      },
    };

    const response = await organization.executeQuery({
      id: query.id,
      variables,
    });

    const error = await expectErrorResponse(c, response);
    expect(error.errors).includes("DataValidationError");
  });
});
