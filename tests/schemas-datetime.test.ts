import { StatusCodes } from "http-status-codes";
import { describe } from "vitest";
import { createUuidDto } from "#/common/types";
import { Permissions } from "#/users/users.types";
import queryJson from "./data/datetime.query.json";
import schemaJson from "./data/datetime.schema.json";
import type { QueryFixture, SchemaFixture } from "./fixture/fixture";
import { createTestFixtureExtension } from "./fixture/it";

describe("schemas.datetime.test", () => {
  const schema = schemaJson as unknown as SchemaFixture;
  const query = queryJson as unknown as QueryFixture;
  const { it, beforeAll, afterAll } = createTestFixtureExtension({
    collection: schema,
    query,
  });
  beforeAll(async (_c) => {});
  afterAll(async (_c) => {});

  it("can upload date-times", async ({ c }) => {
    const { expect, bindings, builder, user } = c;

    const data = [
      { _id: createUuidDto(), datetime: "2024-03-19T14:30:00Z" },
      { _id: createUuidDto(), datetime: "2024-03-19T14:30:00.123Z" },
      { _id: createUuidDto(), datetime: "2024-03-19T14:30:00+01:00" },
    ];

    const result = await builder
      .uploadOwnedData(c, {
        userId: user.did,
        collection: schema.id,
        data,
        permissions: new Permissions(builder.did, {
          read: true,
          write: false,
          execute: false,
        }),
      })
      .expectSuccess();

    expect(result.data.created).toHaveLength(3);

    const cursor = bindings.db.data.collection(schema.id.toString()).find({});
    const records = await cursor.toArray();
    expect(records).toHaveLength(3);
  });

  it("rejects invalid date-times", async ({ c }) => {
    const { builder, user } = c;

    const data = [
      { _id: createUuidDto(), datetime: "2024-03-19" },
      { _id: createUuidDto(), datetime: "14:30:00" },
      { _id: createUuidDto(), datetime: "2024-13-19T14:30:00Z" },
      { _id: createUuidDto(), datetime: "not a date" },
      { _id: createUuidDto(), datetime: 12345 },
    ];

    for (const invalid of data) {
      await builder
        .uploadOwnedData(c, {
          userId: user.did,
          collection: schema.id,
          data: [invalid],
          permissions: new Permissions(builder.did, {
            read: true,
            write: false,
            execute: false,
          }),
        })
        .expectFailure(StatusCodes.BAD_REQUEST, "DataValidationError");
    }
  });

  it("can run query with datetime data", async ({ c }) => {
    const { expect, builder } = c;

    const result = await builder
      .executeQuery(c, {
        id: query.id,
        variables: query.variables,
      })
      .expectSuccess();

    expect(result.data).toEqual([
      {
        datetime: "2024-03-19T14:30:00Z",
      },
    ]);
  });
});
