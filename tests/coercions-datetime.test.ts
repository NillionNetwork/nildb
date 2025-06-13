import { StatusCodes } from "http-status-codes";
import { describe, vi } from "vitest";
import { createUuidDto, Uuid } from "#/common/types";
import collectionJson from "./data/datetime.collection.json";
import queryJson from "./data/datetime.query.json";
import type { CollectionFixture, QueryFixture } from "./fixture/fixture";
import { createTestFixtureExtension } from "./fixture/it";

describe("coercions-datetime.test", () => {
  const collection = collectionJson as unknown as CollectionFixture;
  const query = queryJson as unknown as QueryFixture;
  const { it, beforeAll, afterAll } = createTestFixtureExtension({
    collection,
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
      .createOwnedData(c, {
        owner: user.did,
        collection: collection.id,
        data,
        acl: { grantee: builder.did, read: true, write: false, execute: false },
      })
      .expectSuccess();

    expect(result.data.created).toHaveLength(3);

    const cursor = bindings.db.data
      .collection(collection.id.toString())
      .find({});
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
        .createOwnedData(c, {
          owner: user.did,
          collection: collection.id,
          data: [invalid],
          acl: {
            grantee: builder.did,
            read: true,
            write: false,
            execute: false,
          },
        })
        .expectFailure(StatusCodes.BAD_REQUEST, "DataValidationError");
    }
  });

  it("can run query with datetime data", async ({ c }) => {
    const { expect, builder } = c;

    const runResult = await builder
      .runQuery(c, {
        _id: query.id,
        variables: query.variables,
      })
      .expectSuccess();

    const parseResult = Uuid.safeParse(runResult.data);
    expect(parseResult.success).toBeTruthy();

    const runId = parseResult.data!;

    await vi.waitFor(
      async () => {
        const result = await builder
          .readQueryRunResults(c, runId.toString())
          .expectSuccess();

        expect(result.data.status).toBe("complete");
        return result;
      },
      {
        timeout: 5000,
        interval: 500,
      },
    );
  });
});
