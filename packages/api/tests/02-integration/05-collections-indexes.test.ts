import { describe } from "vitest";

import { createUuidDto } from "@nillion/nildb-types";

import simpleCollection from "../data/simple.collection.json";
import { createTestFixtureExtension } from "../fixture/it.js";

describe("Collection Index Management", () => {
  const { it, beforeAll, afterAll } = createTestFixtureExtension();

  beforeAll(async (c) => {
    const { builder, expect } = c;

    simpleCollection._id = createUuidDto();
    const result = await builder.createCollection({
      _id: simpleCollection._id,
      type: simpleCollection.type as "owned",
      name: simpleCollection.name,
      schema: simpleCollection.schema,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("Test setup failed");
  });
  afterAll(async (_c) => {});

  it("can create an index", async ({ c }) => {
    const { builder, expect } = c;

    // Create an index on the "name" field
    const createResult = await builder.createCollectionIndex(simpleCollection._id, {
      collection: simpleCollection._id,
      name: "name_index",
      keys: [{ name: 1 }],
      unique: false,
    });
    expect(createResult.ok).toBe(true);
    if (!createResult.ok) throw new Error("Test setup failed");

    // Fetch collection metadata to verify the index was created
    const result = await builder.readCollection(simpleCollection._id);

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("Test setup failed");
    expect(result.data.data.indexes).toBeDefined();
    expect(result.data.data.indexes.some((index: any) => index.name === "name_index")).toBe(true);
  });

  it("can drop an index from a collection", async ({ c }) => {
    const { builder, expect } = c;

    // Drop the index
    const indexName = "name_index";
    const dropResult = await builder.dropCollectionIndex(simpleCollection._id, indexName);
    expect(dropResult.ok).toBe(true);

    // Verify the index was removed
    const result = await builder.readCollection(simpleCollection._id);

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("Test setup failed");
    expect(result.data.data.indexes.some((index: any) => index.name === indexName)).toBe(false);
  });
});
