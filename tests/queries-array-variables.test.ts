import { faker } from "@faker-js/faker";
import { beforeAll, describe, expect, it } from "vitest";
import { createUuidDto } from "#/common/types";
import queryJson from "./data/variables.array.query.json";
import schemaJson from "./data/variables.array.schema.json";
import {
  type AppFixture,
  type QueryFixture,
  type SchemaFixture,
  buildFixture,
  registerSchemaAndQuery,
} from "./fixture/app-fixture";
import type { TestOrganizationUserClient } from "./fixture/test-org-user-client";

describe("queries.array.variables.test.ts", () => {
  let fixture: AppFixture;
  let organization: TestOrganizationUserClient;
  const schema = schemaJson as unknown as SchemaFixture;
  const query = queryJson as unknown as QueryFixture;

  // generate test data
  const data = Array.from({ length: 10 }, () => ({
    _id: createUuidDto(),
    values: [faker.number.int(), faker.number.int(), faker.number.int()],
  }));

  beforeAll(async () => {
    fixture = await buildFixture();
    organization = fixture.users.organization;
    await registerSchemaAndQuery(fixture, schema, query);
  });

  it("creates records", async () => {
    const _response = await organization.uploadData({
      schema: schema.id,
      data,
    });
  });

  it("rejects mixed-type arrays", async () => {
    const variables = {
      values: [1, "string"],
    };

    const response = await organization.executeQuery(
      {
        id: query.id,
        variables,
      },
      false,
    );

    expect(response.body.errors).toContain(
      "key=values, reason=Expected number, received string",
    );
  });

  it("can execute with empty array", async () => {
    const variables = {
      values: [],
    };

    const response = await organization.executeQuery({
      id: query.id,
      variables,
    });

    const results = response.body.data as unknown as {
      _id: string;
      totalAmount: number;
      count: number;
    }[];

    expect(results.length).toBe(0);
  });

  it("can use valid array of variables in pipeline", async () => {
    const actual = data[2];
    const variables = {
      values: actual.values,
    };

    const response = await organization.executeQuery({
      id: query.id,
      variables,
    });

    const results = response.body.data as unknown as {
      _id: string;
      values: number[];
    }[];

    expect(results.length).toBe(1);
  });
});
