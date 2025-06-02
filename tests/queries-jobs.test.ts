import { faker } from "@faker-js/faker";
import { Keypair } from "@nillion/nuc";
import { UUID } from "mongodb";
import { Temporal } from "temporal-polyfill";
import { describe } from "vitest";
import { createUuidDto, type UuidDto } from "#/common/types";
import type { QueryJobDocument } from "#/queries/queries.types";
import { Permissions } from "#/user/user.types";
import queryJson from "./data/variables.wallet.query.json";
import schemaJson from "./data/variables.wallet.schema.json";
import { expectSuccessResponse } from "./fixture/assertions";
import type { QueryFixture, SchemaFixture } from "./fixture/fixture";
import { createTestFixtureExtension } from "./fixture/it";

describe("long running query job", () => {
  const userId = Keypair.generate().toDidString();
  let jobId: string;
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

  beforeAll(async (c) => {
    const data: Record[] = Array.from({ length: 10 }, () => ({
      _id: createUuidDto(),
      wallet: faker.finance.ethereumAddress(),
      amount: faker.number.int({ min: 100, max: 1000 }),
      status: faker.helpers.arrayElement(["pending", "completed", "failed"]),
      timestamp: faker.date.recent().toISOString(),
    }));

    await c.organization.uploadData({
      userId,
      schema: schema.id,
      data,
      permissions: new Permissions(c.organization.did, {
        read: true,
        write: false,
        execute: false,
      }),
    });
  });

  afterAll(async (_c) => {});

  it("can start a long-running job", async ({ c }) => {
    const { expect, organization } = c;

    const variables = {
      minAmount: 500,
      status: "completed",
      startDate: Temporal.Now.instant().subtract({ hours: 24 }).toString(),
    };

    const response = await organization.executeQuery({
      id: query.id,
      variables,
      background: true,
    });

    const result = await expectSuccessResponse<{ jobId: string }>(c, response);

    expect(result.data.jobId).toBeDefined();
    jobId = result.data.jobId;
  });

  it("can poll for a job result", async ({ c }) => {
    const { expect, organization } = c;

    expect(jobId).toBeDefined();
    const jobIdUuid = new UUID(jobId);

    const response = await organization.getQueryJob({ id: jobIdUuid });
    let result = await expectSuccessResponse<QueryJobDocument>(c, response);

    for (let attempt = 0; attempt < 5; attempt++) {
      if (result.data.status === "complete") {
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 200));

      const pollResponse = await organization.getQueryJob({
        id: jobIdUuid,
      });
      result = await expectSuccessResponse<QueryJobDocument>(c, pollResponse);
    }

    expect(result.data.status).toBe("complete");
    expect(result.data.result).toBeDefined();
  });
});
