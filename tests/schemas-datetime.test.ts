import { Keypair } from "@nillion/nuc";
import { describe } from "vitest";
import { createUuidDto } from "#/common/types";
import type { UploadResult } from "#/data/data.repository";
import { Permissions } from "#/user/user.types";
import queryJson from "./data/datetime.query.json";
import schemaJson from "./data/datetime.schema.json";
import {
  expectErrorResponse,
  expectSuccessResponse,
} from "./fixture/assertions";
import type { QueryFixture, SchemaFixture } from "./fixture/fixture";
import { createTestFixtureExtension } from "./fixture/it";

describe("schemas.datetime.test", () => {
  const userId = Keypair.generate().toDidString();
  const schema = schemaJson as unknown as SchemaFixture;
  const query = queryJson as unknown as QueryFixture;
  const { it, beforeAll, afterAll } = createTestFixtureExtension({
    schema,
    query,
  });
  beforeAll(async (_c) => {});
  afterAll(async (_c) => {});

  it("can upload date-times", async ({ c }) => {
    const { expect, bindings, organization } = c;

    const data = [
      { _id: createUuidDto(), datetime: "2024-03-19T14:30:00Z" },
      { _id: createUuidDto(), datetime: "2024-03-19T14:30:00.123Z" },
      { _id: createUuidDto(), datetime: "2024-03-19T14:30:00+01:00" },
    ];

    const response = await organization.uploadData({
      userId,
      schema: schema.id,
      data,
      permissions: new Permissions(organization.did, {
        read: true,
        write: false,
        execute: false,
      }),
    });

    const result = await expectSuccessResponse<UploadResult>(c, response);
    expect(result.data.created).toHaveLength(3);

    const cursor = bindings.db.data.collection(schema.id.toString()).find({});
    const records = await cursor.toArray();
    expect(records).toHaveLength(3);
  });

  it("rejects invalid date-times", async ({ c }) => {
    const { expect, organization } = c;

    const data = [
      { _id: createUuidDto(), datetime: "2024-03-19" },
      { _id: createUuidDto(), datetime: "14:30:00" },
      { _id: createUuidDto(), datetime: "2024-13-19T14:30:00Z" },
      { _id: createUuidDto(), datetime: "not a date" },
      { _id: createUuidDto(), datetime: 12345 },
    ];

    for (const invalid of data) {
      const response = await organization.uploadData({
        userId,
        schema: schema.id,
        data: [invalid],
        permissions: new Permissions(organization.did, {
          read: true,
          write: false,
          execute: false,
        }),
      });

      const result = await expectErrorResponse(c, response);
      expect(result.errors).includes("DataValidationError");
    }
  });

  it("can run query with datetime data", async ({ c }) => {
    const { expect, organization } = c;

    const response = await organization.executeQuery({
      id: query.id,
      variables: query.variables,
    });

    const result = await expectSuccessResponse<Record<string, unknown>>(
      c,
      response,
    );

    expect(result.data).toEqual([
      {
        datetime: "2024-03-19T14:30:00Z",
      },
    ]);
  });
});
