import { faker } from "@faker-js/faker";
import { UUID } from "mongodb";
import { Temporal } from "temporal-polyfill";
import { describe } from "vitest";
import { createUuidDto, type UuidDto } from "#/common/types";
import { Permissions } from "#/user/user.types";
import queryJson from "./data/variables.wallet.query.json";
import schemaJson from "./data/variables.wallet.schema.json";
import type { QueryFixture, SchemaFixture } from "./fixture/fixture";
import { createTestFixtureExtension } from "./fixture/it";

describe("long running query job", () => {
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

  it("can start a long-running job", async ({ c }) => {
    const { expect, builder } = c;

    const variables = {
      minAmount: 500,
      status: "completed",
      startDate: Temporal.Now.instant().subtract({ hours: 24 }).toString(),
    };

    const result = (await builder
      .executeQuery(c, {
        id: query.id,
        variables,
        background: true,
      })
      .expectSuccess()) as { data: { jobId: string } };

    expect(result.data.jobId).toBeDefined();
    jobId = result.data.jobId;
  });

  it("can poll for a job result", async ({ c }) => {
    const { expect, builder } = c;

    expect(jobId).toBeDefined();
    const jobIdUuid = new UUID(jobId);

    let result = await builder
      .getQueryJob(c, { id: jobIdUuid })
      .expectSuccess();

    for (let attempt = 0; attempt < 5; attempt++) {
      if (result.data.status === "complete") {
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 200));

      result = await builder
        .getQueryJob(c, {
          id: jobIdUuid,
        })
        .expectSuccess();
    }

    expect(result.data.status).toBe("complete");
    expect(result.data.result).toBeDefined();
  });
});
