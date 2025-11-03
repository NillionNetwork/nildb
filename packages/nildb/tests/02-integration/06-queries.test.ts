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

    await builder
      .createCollection(c, {
        _id: simpleCollection._id,
        type: "standard",
        name: simpleCollection.name,
        schema: simpleCollection.schema,
      })
      .expectSuccess();

    // Create multiple queries for pagination testing
    for (let i = 0; i < 5; i++) {
      const queryId = createUuidDto();
      const query = {
        _id: queryId,
        name: i === 0 ? simpleQuery.name : `Test Query ${i}`,
        collection: simpleCollection._id,
        variables: i === 0 ? simpleQuery.variables : {},
        pipeline: i === 0 ? simpleQuery.pipeline : [{ $match: {} }],
      };
      if (i === 0) {
        simpleQuery._id = queryId;
        simpleQuery.collection = simpleCollection._id;
      }
      await builder.createQuery(c, query).expectSuccess();
    }

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

  it("can list queries with default pagination", async ({ c }) => {
    const { builder, expect } = c;

    const { data, pagination } = await builder.getQueries(c).expectSuccess();
    expect(data).toHaveLength(5);
    expect(pagination.total).toBe(5);
    expect(pagination.limit).toBe(1_000); // Default limit
    expect(pagination.offset).toBe(0); // Default offset
  });

  it("can read the created query", async ({ c }) => {
    const { builder, expect } = c;

    const result = await builder.getQuery(c, simpleQuery._id).expectSuccess();

    expect(result.data._id).toBe(simpleQuery._id);
    expect(result.data.name).toBe(simpleQuery.name);
    expect(result.data.collection).toBe(simpleCollection._id);
  });

  it("can list queries with explicit pagination", async ({ c }) => {
    const { builder, expect } = c;

    const { data, pagination } = await builder
      .getQueries(c, { limit: 2, offset: 2 })
      .expectSuccess();

    expect(data).toHaveLength(2);
    expect(pagination.total).toBe(5);
    expect(pagination.limit).toBe(2);
    expect(pagination.offset).toBe(2);
  });

  it("can run the query and fetch its results", async ({ c }) => {
    const { builder, expect } = c;

    // Execute the query with a variable that matches one document
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
    expect(result.data.result).toHaveLength(1);
    expect(result.data.result?.[0]?.name).toBe(targetName);
  });

  it("can run a query and paginate its results", async ({ c }) => {
    const { builder, expect } = c;

    // Create a query that returns all documents
    const allDocsQueryId = createUuidDto();
    await builder
      .createQuery(c, {
        _id: allDocsQueryId,
        name: "All Documents Query",
        collection: simpleCollection._id,
        variables: {},
        pipeline: [{ $match: {} }],
      })
      .expectSuccess();

    // Execute the query
    const runQueryResponse = await builder
      .runQuery(c, {
        _id: allDocsQueryId,
        variables: {},
      })
      .expectSuccess();
    const jobId = runQueryResponse.data as unknown as UuidDto;

    // Wait for completion
    const fullResult = await waitForQueryRun(c, jobId);
    expect(fullResult.data.status).toBe("complete");
    expect(fullResult.data.result).toHaveLength(3);

    // Test pagination with limit and offset
    const paginatedResult = await builder
      .readQueryRunResults(c, jobId, { limit: 1, offset: 1 })
      .expectSuccess();

    expect(paginatedResult.data.result).toHaveLength(1);
    expect(paginatedResult.pagination).toBeDefined();
    expect(paginatedResult.pagination?.total).toBe(3);
    expect(paginatedResult.pagination?.limit).toBe(1);
    expect(paginatedResult.pagination?.offset).toBe(1);
    expect(paginatedResult.data.result?.[0]?.name).toBe("name2");
  });

  it("can delete the query", async ({ c }) => {
    const { builder, expect } = c;

    // Delete the query
    await builder.deleteQuery(c, simpleQuery._id).expectSuccess();

    // Verify it's deleted by checking the list
    const { data, pagination } = await builder.getQueries(c).expectSuccess();
    expect(data.some((query) => query._id === simpleQuery._id)).toBe(false);
    expect(pagination.total).toBe(5); // We now have 5 queries total (originally 5, created 1 more in pagination test, deleted 1)
  });
});
