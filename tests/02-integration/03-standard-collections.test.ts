import { faker } from "@faker-js/faker";
import { StatusCodes } from "http-status-codes";
import type { DeleteResult } from "mongodb";
import { describe } from "vitest";
import { createUuidDto, type UuidDto } from "#/common/types";
import type { StandardDocumentBase } from "#/data/data.types";
import standardCollectionJson from "../data/wallet.standard.collection.json";
import standardQueryJson from "../data/wallet.standard.query.json";
import type { CollectionFixture, QueryFixture } from "../fixture/fixture";
import { createTestFixtureExtension } from "../fixture/it";

describe("Standard Collections and Queries", () => {
  const standardCollection =
    standardCollectionJson as unknown as CollectionFixture;
  const standardQuery = standardQueryJson as unknown as QueryFixture;

  const { it, beforeAll, afterAll } = createTestFixtureExtension();

  beforeAll(async (_c) => {});
  afterAll(async (_c) => {});

  // Standard Collection Management Tests
  it("can add standard collection", async ({ c }) => {
    const { builder } = c;

    const _id = createUuidDto();
    await builder
      .createCollection(c, {
        _id,
        type: standardCollection.type,
        name: standardCollection.name,
        schema: standardCollection.schema,
      })
      .expectSuccess();

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

    const result = await builder
      .createStandardData(c, {
        collection: standardCollection.id,
        data,
      })
      .expectSuccess();

    expect(result.data.created).toHaveLength(3);

    const cursor = bindings.db.data
      .collection(standardCollection.id.toString())
      .find({});
    const records = await cursor.toArray();
    expect(records).toHaveLength(3);
  });

  it("rejects standard data that does not conform", async ({ c }) => {
    const { builder } = c;

    const data: StandardRecord[] = [
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
        collection: standardCollection.id,
        data,
      })
      .expectFailure(StatusCodes.BAD_REQUEST, "DataValidationError");
  });

  it("can read standard data by a single id", async ({ c }) => {
    const { expect, bindings, builder } = c;

    const expected = await bindings.db.data
      .collection<StandardDocumentBase>(standardCollection.id.toString())
      .findOne({});

    expect(expected).toBeDefined();
    const _id = expected!._id.toString();

    const result = await builder
      .findData(c, {
        collection: standardCollection.id,
        filter: { _id },
      })
      .expectSuccess();

    const actual = result.data[0];
    expect(actual._id).toBe(_id);
  });

  it("can update data via filter", async ({ c }) => {
    const { expect, builder } = c;

    const result = await builder
      .updateData(c, {
        collection: standardCollection.id,
        filter: { country: "CAN" },
        update: { $set: { country: "USA" } },
      })
      .expectSuccess();

    expect(result.data.modified).toBeGreaterThan(0);
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

    const result = await builder
      .deleteData(c, {
        collection: standardCollection.id,
        filter: {
          $coerce: {
            "_id.$in": "uuid",
          },
          _id: { $in: ids },
        },
      })
      .expectSuccess();

    expect(result.data.deletedCount).toEqual(1);
  });

  it("can delete data by filter", async ({ c }) => {
    const { expect, builder } = c;

    const result = await builder
      .deleteData(c, {
        collection: standardCollection.id,
        filter: { country: "USA" },
      })
      .expectSuccess();

    expect((result.data as DeleteResult).deletedCount).toBeGreaterThan(0);
  });

  it("can flush all data from collection", async ({ c }) => {
    const { builder } = c;
    await builder.flushData(c, standardCollection.id).expectSuccess();
  });

  // Standard Collection Query Tests
  type WalletRecord = {
    _id: UuidDto;
    wallet: string;
    age: number;
    country: string;
  };

  it("can create standard collection query", async ({ c }) => {
    const { builder } = c;
    standardQuery.id = createUuidDto();
    standardQuery.collection = standardCollection.id;

    await builder
      .createQuery(c, {
        _id: standardQuery.id,
        name: standardQuery.name,
        collection: standardQuery.collection,
        variables: standardQuery.variables,
        pipeline: standardQuery.pipeline,
      })
      .expectSuccess();
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

    const { builder } = c;

    await builder
      .createStandardData(c, {
        collection: standardCollection.id,
        data,
      })
      .expectSuccess();
  });

  it("can run query on standard collection", async ({ c }) => {
    const { expect, builder } = c;

    const result = await builder
      .runQuery(c, {
        _id: standardQuery.id,
        variables: {},
      })
      .expectSuccess();

    const runId = result.data as UuidDto;
    expect(runId).toBeDefined();
  });

  it("can delete standard collection query", async ({ c }) => {
    const { builder } = c;

    await builder.deleteQuery(c, standardQuery.id.toString()).expectSuccess();
  });

  it("can delete standard collection", async ({ c }) => {
    const { builder } = c;
    await builder.deleteCollection(c, standardCollection.id).expectSuccess();
  });
});
