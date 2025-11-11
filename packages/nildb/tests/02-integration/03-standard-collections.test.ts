import { faker } from "@faker-js/faker";
import type { StandardDocumentBase } from "@nildb/data/data.types";
import { createUuidDto, type UuidDto } from "@nillion/nildb-types";
import type { DeleteResult } from "mongodb";
import { describe } from "vitest";
import standardCollectionJson from "../data/wallet.standard.collection.json";
import standardQueryJson from "../data/wallet.standard.query.json";
import type { CollectionFixture, QueryFixture } from "../fixture/fixture.js";
import { createTestFixtureExtension } from "../fixture/it.js";

describe("Standard Collections and Queries", () => {
  const standardCollection =
    standardCollectionJson as unknown as CollectionFixture;
  const standardQuery = standardQueryJson as unknown as QueryFixture;

  const { it, beforeAll, afterAll } = createTestFixtureExtension();

  beforeAll(async (_c) => {});
  afterAll(async (_c) => {});

  // Standard Collection Management Tests
  it("can add standard collection", async ({ c }) => {
    const { builder, expect } = c;

    const _id = createUuidDto();
    const result = await builder.createCollection({
      _id,
      type: standardCollection.type,
      name: standardCollection.name,
      schema: standardCollection.schema,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("Test setup failed");

    standardCollection.id = _id;
  });

  // Standard Data Tests
  type StandardRecord = {
    _id: UuidDto;
    wallet: string;
    country: string;
    age: number;
  };

  it("can upload standard data", async ({ c }) => {
    const { expect, bindings, builder } = c;

    const data: StandardRecord[] = [
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

    const result = await builder.createStandardData({
      collection: standardCollection.id,
      data,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("Test setup failed");
    expect(result.data.data.created).toHaveLength(3);

    const cursor = bindings.db.data
      .collection(standardCollection.id.toString())
      .find({});
    const records = await cursor.toArray();
    expect(records).toHaveLength(3);
  });

  it("rejects standard data that does not conform", async ({ c }) => {
    const { expect, builder } = c;

    const data: StandardRecord[] = [
      {
        _id: createUuidDto(),
        // @ts-expect-error should be string but want to check rejection
        wallet: true,
        country: "GBR",
        age: 30,
      },
    ];

    const result = await builder.createStandardData({
      collection: standardCollection.id,
      data,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBeDefined();
    }
  });

  it("can read standard data by a single id", async ({ c }) => {
    const { expect, bindings, builder } = c;

    const expected = await bindings.db.data
      .collection<StandardDocumentBase>(standardCollection.id.toString())
      .findOne({});

    expect(expected).toBeDefined();
    const _id = expected!._id.toString();

    const result = await builder.findData({
      collection: standardCollection.id,
      filter: { _id },
    });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("Test setup failed");
    const actual = result.data.data[0];
    expect(actual._id).toBe(_id);
    expect(result.data.pagination.total).toBe(1);
  });

  it("can find standard data with pagination", async ({ c }) => {
    const { expect, builder } = c;

    // Total data count is 3 at this point in the test file
    const result = await builder.findData({
      collection: standardCollection.id,
      filter: {},
      pagination: { limit: 1, offset: 1 },
    });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("Test setup failed");
    expect(result.data.data).toHaveLength(1);
    expect(result.data.pagination.total).toBe(3);
    expect(result.data.pagination.limit).toBe(1);
    expect(result.data.pagination.offset).toBe(1);
  });

  it("can update data via filter", async ({ c }) => {
    const { expect, builder } = c;

    const result = await builder.updateData({
      collection: standardCollection.id,
      filter: { country: "CAN" },
      update: { $set: { country: "USA" } },
    });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("Test setup failed");
    expect(result.data.data.modified).toBeGreaterThan(0);
  });

  it("can delete standard data", async ({ c }) => {
    const { expect, bindings, builder } = c;

    const expected = await bindings.db.data
      .collection<StandardDocumentBase>(standardCollection.id.toString())
      .find({})
      .limit(1)
      .toArray();

    expect(expected).toBeDefined();
    const ids = expected.map((document) => document._id.toString());

    const result = await builder.deleteData({
      collection: standardCollection.id,
      filter: {
        $coerce: {
          "_id.$in": "uuid",
        },
        _id: { $in: ids },
      },
    });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("Test setup failed");
    expect(result.data.data.deletedCount).toEqual(1);
  });

  it("can delete data by filter", async ({ c }) => {
    const { expect, builder } = c;

    const result = await builder.deleteData({
      collection: standardCollection.id,
      filter: { country: "USA" },
    });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("Test setup failed");
    expect((result.data.data as DeleteResult).deletedCount).toBeGreaterThan(0);
  });

  it("can flush all data from collection", async ({ c }) => {
    const { builder, expect } = c;
    const result = await builder.flushData(standardCollection.id);
    expect(result.ok).toBe(true);
  });

  // Standard Collection Query Tests
  type WalletRecord = {
    _id: UuidDto;
    wallet: string;
    age: number;
    country: string;
  };

  it("can create standard collection query", async ({ c }) => {
    const { builder, expect } = c;
    standardQuery.id = createUuidDto();
    standardQuery.collection = standardCollection.id;

    const result = await builder.createQuery({
      _id: standardQuery.id,
      name: standardQuery.name,
      collection: standardQuery.collection,
      variables: standardQuery.variables,
      pipeline: standardQuery.pipeline,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("Test setup failed");
  });

  it("can create wallet test data for standard query execution", async ({
    c,
  }) => {
    const data: WalletRecord[] = Array.from({ length: 5 }, () => ({
      _id: createUuidDto(),
      wallet: faker.finance.ethereumAddress(),
      age: faker.number.int({ min: 100, max: 1000 }),
      country: faker.location.countryCode(),
    }));

    const { builder, expect } = c;

    const result = await builder.createStandardData({
      collection: standardCollection.id,
      data,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("Test setup failed");
  });

  it("can run query on standard collection", async ({ c }) => {
    const { expect, builder } = c;

    const result = await builder.runQuery({
      _id: standardQuery.id,
      variables: {},
    });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("Test setup failed");
    const runId = result.data.data as UuidDto;
    expect(runId).toBeDefined();
  });

  it("can delete standard collection query", async ({ c }) => {
    const { builder, expect } = c;

    const result = await builder.deleteQuery(standardQuery.id.toString());
    expect(result.ok).toBe(true);
  });

  it("can delete standard collection", async ({ c }) => {
    const { builder, expect } = c;
    const result = await builder.deleteCollection(standardCollection.id);
    expect(result.ok).toBe(true);
  });
});
