import { describe } from "vitest";
import { createUuidDto, type UuidDto } from "#/common/types";
import simpleCollection from "#tests/data/simple.collection.json";
import simpleQuery from "#tests/data/simple.query.json";
import { waitForQueryRun } from "#tests/fixture/assertions";
import { createTestFixtureExtension } from "#tests/fixture/it";

describe("Query Lifecycle", () => {
  const { it, beforeAll, afterAll } = createTestFixtureExtension();

  beforeAll(async (c) => {
    const { builder } = c;

    simpleCollection._id = createUuidDto();
    simpleQuery._id = createUuidDto();
    simpleQuery.collection = simpleCollection._id;

    await builder
      .createCollection(c, {
        _id: simpleCollection._id,
        type: "standard",
        name: simpleCollection.name,
        schema: simpleCollection.schema,
      })
      .expectSuccess();

    // Add some test data to the collection
    await builder
      .createStandardData(c, {
        collection: simpleCollection._id,
        data: [
          { _id: createUuidDto(), name: "name1" },
          { _id: createUuidDto(), name: "name2" },
          { _id: createUuidDto(), name: "name3" },
        ],
      })
      .expectSuccess();
  });

  afterAll(async (_c) => {});

  it("can list queries and returns an empty array", async ({ c }) => {
    const { builder, expect } = c;

    const { data } = await builder.getQueries(c).expectSuccess();
    expect(data).toEqual([]);
  });

  it("can create a new query", async ({ c }) => {
    const { builder } = c;
    await builder.createQuery(c, simpleQuery).expectSuccess();
  });

  it("can read the created query", async ({ c }) => {
    const { builder, expect } = c;

    const result = await builder.getQuery(c, simpleQuery._id).expectSuccess();

    expect(result.data._id).toBe(simpleQuery._id);
    expect(result.data.name).toBe(simpleQuery.name);
    expect(result.data.collection).toBe(simpleCollection._id);
  });

  it("can list queries and returns the created query", async ({ c }) => {
    const { builder, expect } = c;

    // Create a query first
    const queryId = createUuidDto();
    await builder
      .createQuery(c, {
        _id: queryId,
        name: "List Test Query",
        collection: simpleCollection._id,
        variables: {},
        pipeline: [{ $match: { category: "A" } }],
      })
      .expectSuccess();

    // List queries and verify it appears
    const result = await builder.getQueries(c).expectSuccess();
    expect(result.data).toHaveLength(2);
  });

  it("can run the query and fetch its results", async ({ c }) => {
    const { builder, expect } = c;

    // Execute the query
    const targetName = "name2";
    const runQueryResponse = await builder
      .runQuery(c, {
        _id: simpleQuery._id,
        variables: { name: targetName },
      })
      .expectSuccess();
    const jobId = runQueryResponse.data as unknown as UuidDto;
    expect(jobId).toBeDefined();

    // Wait for results and verify completion
    const result = await waitForQueryRun(c, jobId);
    expect(result.data.status).toBe("complete");
    expect(result.data.result).toBeDefined();
    expect(result.data.result.at(0).name).toBe(targetName);
  });

  it("can delete the query", async ({ c }) => {
    const { builder, expect } = c;

    // Delete the query
    await builder.deleteQuery(c, simpleQuery._id).expectSuccess();

    // Verify it's deleted by checking the list
    const result = await builder.getQueries(c).expectSuccess();
    const queryDocument = result.data.some(
      (query) => query._id === simpleQuery._id,
    );
    expect(queryDocument).toBe(false);
  });
});
