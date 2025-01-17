import { beforeAll, describe, expect, it } from "vitest";
import { createUuidDto } from "#/common/types";
import type { Context } from "#/env";
import queryJson from "./data/datetime.query.json";
import schemaJson from "./data/datetime.schema.json";
import {
  type AppFixture,
  type QueryFixture,
  type SchemaFixture,
  buildFixture,
  registerSchemaAndQuery,
} from "./fixture/app-fixture";
import type { TestOrganizationUserClient } from "./fixture/test-org-user-client";

describe("schemas.datetime.test", async () => {
  let fixture: AppFixture;
  let db: Context["db"];
  let organization: TestOrganizationUserClient;
  const schema = schemaJson as unknown as SchemaFixture;
  const query = queryJson as unknown as QueryFixture;

  beforeAll(async () => {
    fixture = await buildFixture();
    db = fixture.ctx.db;
    organization = fixture.users.organization;
    await registerSchemaAndQuery(fixture, schema, query);
  });

  it("can upload date-times", async () => {
    const data = [
      { _id: createUuidDto(), datetime: "2024-03-19T14:30:00Z" },
      { _id: createUuidDto(), datetime: "2024-03-19T14:30:00.123Z" },
      { _id: createUuidDto(), datetime: "2024-03-19T14:30:00+01:00" },
    ];

    const response = await organization.uploadData({
      schema: schema.id,
      data,
    });
    expect(response.body.data.created).toHaveLength(3);

    const cursor = db.data.collection(schema.id.toString()).find({});
    const records = await cursor.toArray();
    expect(records).toHaveLength(3);
  });

  it("rejects invalid date-times", async () => {
    const data = [
      { _id: createUuidDto(), datetime: "2024-03-19" },
      { _id: createUuidDto(), datetime: "14:30:00" },
      { _id: createUuidDto(), datetime: "2024-13-19T14:30:00Z" },
      { _id: createUuidDto(), datetime: "not a date" },
      { _id: createUuidDto(), datetime: 12345 },
    ];

    for (const invalid of data) {
      const response = await organization.uploadData(
        {
          schema: schema.id,
          data: [invalid],
        },
        false,
      );
      expect(response.body.errors).toContain("Schema validation failed");
    }
  });

  it("can run query with datetime data", async () => {
    const response = await organization.executeQuery({
      id: query.id,
      variables: query.variables,
    });

    expect(response.body.data).toEqual([
      {
        datetime: "2024-03-19T14:30:00Z",
      },
    ]);
  });
});
