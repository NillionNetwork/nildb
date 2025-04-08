import { faker } from "@faker-js/faker";
import { StatusCodes } from "http-status-codes";
import { Temporal } from "temporal-polyfill";
import { describe } from "vitest";
import type { AccountSubscriptionDocument } from "#/accounts/accounts.types";
import { type UuidDto, createUuidDto } from "#/common/types";
import { TAIL_DATA_LIMIT } from "#/data/data.repository";
import queryJson from "./data/simple.query.json";
import schemaJson from "./data/simple.schema.json";
import { expectSuccessResponse } from "./fixture/assertions";
import type { QueryFixture, SchemaFixture } from "./fixture/fixture";
import { createTestFixtureExtension } from "./fixture/it";

// TODO: refactor to work with the new NUCS + nilAuth
describe.skip("subscriptions.test.ts", () => {
  const schema = schemaJson as unknown as SchemaFixture;
  const query = queryJson as unknown as QueryFixture;
  const { it, beforeAll, afterAll } = createTestFixtureExtension({
    schema,
    query,
  });

  type Record = {
    _id: UuidDto;
    name: string;
  };
  const collectionSize = 100;
  const data: Record[] = Array.from({ length: collectionSize }, () => ({
    _id: createUuidDto(),
    name: faker.person.fullName(),
  }));

  beforeAll(async ({ organization }) => {
    await organization.uploadData({
      schema: schema.id,
      data,
    });
  });

  afterAll(async (_ctx) => {});

  it("no subscription required for admins", async ({ expect, admin }) => {
    const response = await admin.tailData({
      schema: schema.id,
    });

    const result = await expectSuccessResponse<Record[]>(response);
    expect(result.data).toHaveLength(TAIL_DATA_LIMIT);
  });

  it("rejects if subscription inactive", async ({
    expect,
    admin,
    organization,
  }) => {
    const now = Temporal.Now.instant();
    const start = now.add({ hours: 24 });
    const end = start.add({ hours: 24 });
    const txHash = "";
    const setSubscriptionResponse = await admin.setSubscriptionState({
      did: organization.did,
      start: new Date(start.epochMilliseconds),
      end: new Date(end.epochMilliseconds),
      txHash,
    });
    expect(setSubscriptionResponse.status).toBe(StatusCodes.OK);

    const response = await organization.tailData({
      schema: schema.id,
    });
    expect(response.status).toBe(StatusCodes.PAYMENT_REQUIRED);
  });

  it("accepts if subscription active", async ({
    expect,
    admin,
    organization,
  }) => {
    const txHash = "";
    const setSubscriptionResponse = await admin.setSubscriptionState({
      did: organization.did,
      txHash,
    });
    expect(setSubscriptionResponse.status).toBe(StatusCodes.OK);

    const response = await organization.tailData({
      schema: schema.id,
    });

    const result = await expectSuccessResponse<Record[]>(response);
    expect(result.data).toHaveLength(TAIL_DATA_LIMIT);
  });

  it("organization can query its subscription", async ({
    expect,
    organization,
  }) => {
    const response = await organization.getSubscriptionState();
    expect(response.status).toBe(StatusCodes.OK);
    const result =
      await expectSuccessResponse<AccountSubscriptionDocument>(response);
    expect(result.data.active).toBeTruthy;
  });

  it("admin can query an organization subscription", async ({
    expect,
    admin,
    organization,
  }) => {
    const response = await admin.getSubscriptionState(organization.did);
    expect(response.status).toBe(StatusCodes.OK);
    const result =
      await expectSuccessResponse<AccountSubscriptionDocument>(response);
    expect(result.data.active).toBeTruthy;
  });
});
