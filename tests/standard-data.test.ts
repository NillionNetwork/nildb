import { StatusCodes } from "http-status-codes";
import type { DeleteResult } from "mongodb";
import { describe } from "vitest";
import { createUuidDto, type UuidDto } from "#/common/types";
import type { StandardDocumentBase } from "#/data/data.types";
import collectionJson from "./data/wallet.standard.collection.json";
import queryJson from "./data/wallet.standard.query.json";
import { waitForQueryRun } from "./fixture/assertions";
import type { CollectionFixture, QueryFixture } from "./fixture/fixture";
import { createTestFixtureExtension } from "./fixture/it";

describe("standard-data.test.ts", () => {
  const collection = collectionJson as unknown as CollectionFixture;
  const query = queryJson as unknown as QueryFixture;
  const { it, beforeAll, afterAll } = createTestFixtureExtension({
    collection,
    query,
  });
  beforeAll(async (_c) => {});
  afterAll(async (_c) => {});

  type Record = {
    _id: UuidDto;
    wallet: string;
    country: string;
    age: number;
  };

  it("can upload data", async ({ c }) => {
    const { expect, bindings, builder } = c;

    const data: Record[] = [
      {
        _id: createUuidDto(),
        wallet: "0x1",
        country: "GBR",
        age: 20,
      },
      {
        _id: createUuidDto(),
        wallet: "0x2",
        country: "CAN",
        age: 30,
      },
      {
        _id: createUuidDto(),
        wallet: "0x3",
        country: "GBR",
        age: 40,
      },
    ];

    const result = await builder
      .createStandardData(c, {
        collection: collection.id,
        data,
      })
      .expectSuccess();

    expect(result.data.created).toHaveLength(3);

    const cursor = bindings.db.data
      .collection(collection.id.toString())
      .find({});
    const records = await cursor.toArray();
    expect(records).toHaveLength(3);
  });

  it.skip("rejects primary key collisions", async ({ c }) => {
    const { expect, bindings, builder } = c;

    const data = [
      {
        _id: createUuidDto(),
        wallet: "0x1",
        country: "GBR",
        age: 30,
      },
    ];

    const result = await builder
      .createStandardData(c, {
        collection: collection.id,
        data,
      })
      .expectSuccess();

    expect(result.data.errors).toHaveLength(1);

    const cursor = bindings.db.data
      .collection(collection.id.toString())
      .find({});
    const records = await cursor.toArray();
    expect(records).toHaveLength(3);
  });

  it.skip("allows for partial success", async ({ skip, c }) => {
    skip("depends on indexes, disable until index endpoint is ready");
    const { expect, builder } = c;

    const data: Record[] = [
      {
        _id: createUuidDto(),
        wallet: "0x1", // collides expect failure
        country: "GBR",
        age: 30,
      },
      {
        _id: createUuidDto(),
        wallet: "0x4", // unique expect success
        country: "GBR",
        age: 30,
      },
    ];

    const result = await builder
      .createStandardData(c, {
        collection: collection.id,
        data,
      })
      .expectSuccess();

    expect(result.data.errors).toHaveLength(1);
    expect(result.data.created).toHaveLength(1);
  });

  it.skip("rejects duplicates in data payload", async ({ skip, c }) => {
    skip("depends on indexes, disable until index endpoint is ready");
    const { expect, builder } = c;

    const data: Record[] = [
      {
        _id: createUuidDto(),
        wallet: "0x4",
        country: "GBR",
        age: 30,
      },
      {
        _id: createUuidDto(),
        wallet: "0x4",
        country: "GBR",
        age: 30,
      },
    ];

    await builder
      .createStandardData(c, {
        collection: collection.id,
        data,
      })
      .expectSuccess();

    const cursor = c.bindings.db.data
      .collection(collection.id.toString())
      .find({});
    const records = await cursor.toArray();
    expect(records).toHaveLength(4);
  });

  it("rejects data that does not conform", async ({ c }) => {
    const { builder } = c;

    const data: Record[] = [
      {
        _id: createUuidDto(),
        // @ts-expect-error should be string but want to check rejection
        wallet: true,
        country: "GBR",
        age: 30,
      },
    ];

    await builder
      .createStandardData(c, {
        collection: collection.id,
        data,
      })
      .expectFailure(StatusCodes.BAD_REQUEST, "DataValidationError");
  });

  it("can run a query", async ({ c }) => {
    const { expect, builder } = c;

    const runId = (
      await builder
        .runQuery(c, {
          _id: query.id,
          variables: query.variables,
        })
        .expectSuccess()
    ).data as UuidDto;

    const result = await waitForQueryRun(c, runId);
    expect(result.data.result).toEqual([
      {
        averageAge: 30,
        count: 2,
      },
    ]);
  });

  it("can read data by a single id", async ({ c }) => {
    const { expect, bindings, builder } = c;

    const expected = await bindings.db.data
      .collection<StandardDocumentBase>(collection.id.toString())
      .findOne({});

    expect(expected).toBeDefined();
    const _id = expected!._id.toString();

    const result = await builder
      .findData(c, {
        collection: collection.id,
        filter: { _id },
      })
      .expectSuccess();

    const actual = result.data[0];
    expect(actual._id).toBe(_id);
  });

  it("can read data from a list of ids", async ({ c }) => {
    const { expect, bindings, builder } = c;

    const expected = await bindings.db.data
      .collection<StandardDocumentBase>(collection.id.toString())
      .find({})
      .limit(3)
      .toArray();

    expect(expected).toBeDefined();
    const ids = expected.map((document) => document._id.toString());

    const result = await builder
      .findData(c, {
        collection: collection.id,
        filter: { _id: { $in: ids } },
      })
      .expectSuccess();

    expect(result.data).toHaveLength(3);
  });

  it("can delete data", async ({ c }) => {
    const { expect, bindings, builder } = c;

    const expected = await bindings.db.data
      .collection<StandardDocumentBase>(collection.id.toString())
      .find({})
      .limit(1)
      .toArray();

    expect(expected).toBeDefined();
    const ids = expected.map((document) => document._id.toString());

    const result = await builder
      .deleteData(c, {
        collection: collection.id,
        filter: { _id: { $in: ids } },
      })
      .expectSuccess();

    expect((result.data as DeleteResult).deletedCount).toEqual(1);
  });
});
