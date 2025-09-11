import { describe } from "vitest";
import { createUuidDto } from "#/common/types";
import simpleCollection from "#tests/data/simple.collection.json";
import { createTestFixtureExtension } from "#tests/fixture/it";

describe("Collection Index Management", () => {
  const { it, beforeAll, afterAll } = createTestFixtureExtension();

  beforeAll(async (c) => {
    const { builder } = c;

    simpleCollection._id = createUuidDto();
    await builder
      .createCollection(c, {
        _id: simpleCollection._id,
        type: simpleCollection.type as "owned",
        name: simpleCollection.name,
        schema: simpleCollection.schema,
      })
      .expectSuccess();
  });
  afterAll(async (_c) => {});

  it("can create an index", async ({ c }) => {
    const { builder, expect } = c;

    // Create an index on the "name" field
    await builder
      .createCollectionIndex(c, simpleCollection._id, {
        collection: simpleCollection._id,
        name: "name_index",
        keys: [{ name: 1 }],
        unique: false,
      })
      .expectSuccess();

    // Fetch collection metadata to verify the index was created
    const { data } = await builder
      .readCollection(c, simpleCollection._id)
      .expectSuccess();

    expect(data.indexes).toBeDefined();
    expect(data.indexes.some((index: any) => index.name === "name_index")).toBe(
      true,
    );
  });

  it("can drop an index from a collection", async ({ c }) => {
    const { builder, expect } = c;

    // Drop the index
    const indexName = "name_index";
    await builder
      .dropCollectionIndex(c, simpleCollection._id, indexName)
      .expectSuccess();

    // Verify the index was removed
    const result = await builder
      .readCollection(c, simpleCollection._id)
      .expectSuccess();

    expect(
      result.data.indexes.some((index: any) => index.name === indexName),
    ).toBe(false);
  });
});
