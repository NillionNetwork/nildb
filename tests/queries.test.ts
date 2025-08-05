import { describe } from "vitest";
import type { CollectionDocument } from "#/collections/collections.types";
import { CollectionName } from "#/common/mongo";
import { createUuidDto } from "#/common/types";
import collectionJson from "./data/simple.collection.json";
import queryJson from "./data/simple.query.json";
import { expectBuilder } from "./fixture/assertions";
import type { CollectionFixture, QueryFixture } from "./fixture/fixture";
import { createTestFixtureExtension } from "./fixture/it";

describe("query.test.ts", () => {
  const collection = collectionJson as unknown as CollectionFixture;
  const query = queryJson as unknown as QueryFixture;

  // don't pass in query since this suite is testing query creation
  const { it, beforeAll, afterAll } = createTestFixtureExtension({
    collection,
  });
  beforeAll(async (_ctx) => {
    query.collection = collection.id;
  });

  afterAll(async (_c) => {});

  it("can list queries (expect 0)", async ({ c }) => {
    const { expect, builder } = c;
    const { data } = await builder.getQueries(c).expectSuccess();
    expect(data).toHaveLength(0);
  });

  it("can add a query", async ({ c }) => {
    const { builder } = c;
    query.id = createUuidDto();
    await builder
      .createQuery(c, {
        _id: query.id,
        name: query.name,
        collection: query.collection,
        variables: query.variables,
        pipeline: query.pipeline,
      })
      .expectSuccess();
  });

  it("can list queries (expect 1)", async ({ c }) => {
    const { expect, builder } = c;
    const { data } = await builder.getQueries(c).expectSuccess();
    expect(data).toHaveLength(1);
  });

  it("can read a query", async ({ c }) => {
    const { builder } = c;

    await builder.getQuery(c, query.id.toString()).expectSuccess();
  });

  it("can delete a query", async ({ c }) => {
    const { expect, bindings, builder } = c;

    await builder.deleteQuery(c, query.id.toString()).expectSuccess();

    const queryDocument = await bindings.db.primary
      .collection<CollectionDocument>(CollectionName.Collections)
      .findOne({ id: query.id });

    expect(queryDocument).toBeNull();

    const builderDocument = await expectBuilder(c, builder.did.didString);
    expect(builderDocument.queries).toHaveLength(0);
  });
});
