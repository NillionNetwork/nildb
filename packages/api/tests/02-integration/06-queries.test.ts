import type { BuilderDocument } from "@nildb/builders/builders.types";
import { CollectionName } from "@nildb/common/mongo";
// oxlint-disable-next-line import/extensions
import { secp256k1 } from "@noble/curves/secp256k1.js";
// oxlint-disable-next-line import/extensions
import { bytesToHex } from "@noble/hashes/utils.js";
import { StatusCodes } from "http-status-codes";
import { ObjectId } from "mongodb";
import { describe } from "vitest";

import { createUuidDto, PathsV1, type UuidDto } from "@nillion/nildb-types";
import { Builder, Did, Signer } from "@nillion/nuc";

import simpleCollection from "../data/simple.collection.json";
import simpleQuery from "../data/simple.query.json";
import { waitForQueryRun } from "../fixture/assertions";
import { createTestFixtureExtension } from "../fixture/it";

describe("Query Lifecycle", () => {
  const { it, beforeAll, afterAll } = createTestFixtureExtension();
  let attackerSigner: Signer;

  beforeAll(async (c) => {
    const { bindings, builder, expect } = c;

    simpleCollection._id = createUuidDto();

    const createCollectionResult = await builder.createCollection({
      _id: simpleCollection._id,
      type: "standard",
      name: simpleCollection.name,
      schema: simpleCollection.schema,
    });
    expect(createCollectionResult.ok).toBe(true);
    if (!createCollectionResult.ok) throw new Error("Test setup failed");

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
      const createQueryResult = await builder.createQuery(query);
      expect(createQueryResult.ok).toBe(true);
      if (!createQueryResult.ok) throw new Error("Test setup failed");
    }

    // Add some test data to the collection
    const createDataResult = await builder.createStandardData({
      collection: simpleCollection._id,
      data: [
        { _id: createUuidDto(), name: "name1" },
        { _id: createUuidDto(), name: "name2" },
        { _id: createUuidDto(), name: "name3" },
      ],
    });
    expect(createDataResult.ok).toBe(true);
    if (!createDataResult.ok) throw new Error("Test setup failed");

    attackerSigner = Signer.fromPrivateKey(bytesToHex(secp256k1.utils.randomSecretKey()));
    const attackerDid = Did.serialize(await attackerSigner.getDid());
    const now = new Date();
    await bindings.db.primary.collection<BuilderDocument>(CollectionName.Builders).insertOne({
      _id: new ObjectId(),
      did: attackerDid,
      _created: now,
      _updated: now,
      name: "query-result-attacker",
      collections: [],
      queries: [],
      creditsUsd: 0,
      storageBytes: 0,
    });
  });

  afterAll(async (_c) => {});

  it("can list queries with default pagination", async ({ c }) => {
    const { builder, expect } = c;

    const result = await builder.getQueries();
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("Test setup failed");
    expect(result.data.data).toHaveLength(5);
    expect(result.data.pagination.total).toBe(5);
    expect(result.data.pagination.limit).toBe(1_000); // Default limit
    expect(result.data.pagination.offset).toBe(0); // Default offset
  });

  it("can read the created query", async ({ c }) => {
    const { builder, expect } = c;

    const result = await builder.getQuery(simpleQuery._id);

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("Test setup failed");
    expect(result.data.data._id).toBe(simpleQuery._id);
    expect(result.data.data.name).toBe(simpleQuery.name);
    expect(result.data.data.collection).toBe(simpleCollection._id);
  });

  it("can list queries with explicit pagination", async ({ c }) => {
    const { builder, expect } = c;

    const result = await builder.getQueries({
      limit: 2,
      offset: 2,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("Test setup failed");
    expect(result.data.data).toHaveLength(2);
    expect(result.data.pagination.total).toBe(5);
    expect(result.data.pagination.limit).toBe(2);
    expect(result.data.pagination.offset).toBe(2);
  });

  it("rejects server-side JavaScript in query pipelines", async ({ c }) => {
    const result = await c.builder.createQuery({
      _id: createUuidDto(),
      name: "Unsafe JavaScript Query",
      collection: simpleCollection._id,
      variables: {},
      pipeline: [{ $match: { nested: { $where: "while (true) {}" } } }],
    });

    c.expect(result.ok).toBe(false);
    if (!result.ok) c.expect(result.status).toBe(StatusCodes.BAD_REQUEST);
  });

  it("can run the query and fetch its results", async ({ c }) => {
    const { builder, expect } = c;

    // Execute the query with a variable that matches one document
    const targetName = "name2";
    const runQueryResponse = await builder.runQuery({
      _id: simpleQuery._id,
      variables: { name: targetName },
    });
    expect(runQueryResponse.ok).toBe(true);
    if (!runQueryResponse.ok) throw new Error("Test setup failed");
    const jobId = runQueryResponse.data.data as unknown as UuidDto;
    expect(jobId).toBeDefined();

    // Wait for results and verify completion
    const result = await waitForQueryRun(c, jobId);
    expect(result.data.status).toBe("complete");
    expect(result.data.result).toBeDefined();
    expect(result.data.result).toHaveLength(1);
    expect(result.data.result?.[0]?.name).toBe(targetName);
  });

  it("does not expose query results to another builder with the run id", async ({ c }) => {
    const { app, bindings, builder, expect } = c;
    const runQueryResponse = await builder.runQuery({
      _id: simpleQuery._id,
      variables: { name: "name2" },
    });
    expect(runQueryResponse.ok).toBe(true);
    if (!runQueryResponse.ok) throw new Error("Test setup failed");

    const jobId = runQueryResponse.data.data as unknown as UuidDto;
    await waitForQueryRun(c, jobId);

    const attackerDid = await attackerSigner.getDid();
    const token = await Builder.invocation()
      .command("/nil/db/queries/read")
      .audience(bindings.node.did)
      .subject(attackerDid)
      .expiresIn(60_000)
      .signAndSerialize(attackerSigner);
    const response = await app.request(PathsV1.queries.runById.replace(":id", jobId), {
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(response.status).toBe(StatusCodes.NOT_FOUND);
  });

  it("can run a query and paginate its results", async ({ c }) => {
    const { builder, expect } = c;

    // Create a query that returns all documents
    const allDocsQueryId = createUuidDto();
    const createQueryResult = await builder.createQuery({
      _id: allDocsQueryId,
      name: "All Documents Query",
      collection: simpleCollection._id,
      variables: {},
      pipeline: [{ $match: {} }],
    });
    expect(createQueryResult.ok).toBe(true);

    // Execute the query
    const runQueryResponse = await builder.runQuery({
      _id: allDocsQueryId,
      variables: {},
    });
    expect(runQueryResponse.ok).toBe(true);
    if (!runQueryResponse.ok) throw new Error("Test setup failed");
    const jobId = runQueryResponse.data.data as unknown as UuidDto;

    // Wait for completion
    const fullResult = await waitForQueryRun(c, jobId);
    expect(fullResult.data.status).toBe("complete");
    expect(fullResult.data.result).toHaveLength(3);

    // Test pagination with limit and offset
    const paginatedResult = await builder.readQueryRunResults(jobId, {
      limit: 1,
      offset: 1,
    });

    expect(paginatedResult.ok).toBe(true);
    if (!paginatedResult.ok) throw new Error("Test setup failed");
    expect(paginatedResult.data.data.result).toHaveLength(1);
    expect(paginatedResult.data.pagination).toBeDefined();
    expect(paginatedResult.data.pagination?.total).toBe(3);
    expect(paginatedResult.data.pagination?.limit).toBe(1);
    expect(paginatedResult.data.pagination?.offset).toBe(1);
    expect(paginatedResult.data.data.result?.[0]?.name).toBe("name2");
  });

  it("can delete the query", async ({ c }) => {
    const { builder, expect } = c;

    // Delete the query
    const deleteResult = await builder.deleteQuery(simpleQuery._id);
    expect(deleteResult.ok).toBe(true);

    // Verify it's deleted by checking the list
    const result = await builder.getQueries();
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("Test setup failed");
    expect(result.data.data.some((query: any) => query._id === simpleQuery._id)).toBe(false);
    expect(result.data.pagination.total).toBe(5); // We now have 5 queries total (originally 5, created 1 more in pagination test, deleted 1)
  });
});
