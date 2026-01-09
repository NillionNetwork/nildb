import { describe } from "vitest";

import { createUuidDto } from "@nillion/nildb-types";

import simpleCollection from "../data/simple.collection.json";
import simpleQuery from "../data/simple.query.json";
import { createTestFixtureExtension } from "../fixture/it.js";

describe("User Endpoints", () => {
  const { it, beforeAll, afterAll } = createTestFixtureExtension();

  beforeAll(async (c) => {
    const { builder, expect, userSigner, builderSigner } = c;

    simpleCollection._id = createUuidDto();
    simpleQuery._id = createUuidDto();
    simpleQuery.collection = simpleCollection._id;

    const createCollectionResult = await builder.createCollection({
      _id: simpleCollection._id,
      type: "owned",
      name: simpleCollection.name,
      schema: simpleCollection.schema,
    });
    expect(createCollectionResult.ok).toBe(true);
    if (!createCollectionResult.ok) throw new Error("Test setup failed");

    // Add multiple data documents for the user to enable pagination testing
    const dataToCreate = Array.from({ length: 5 }, () => ({
      _id: createUuidDto(),
      name: "user-data-item",
    }));

    const createDataResult = await builder.createOwnedData({
      owner: (await userSigner.getDid()).didString,
      collection: simpleCollection._id,
      data: dataToCreate,
      acl: {
        grantee: (await builderSigner.getDid()).didString,
        read: true,
        write: false,
        execute: false,
      },
    });
    expect(createDataResult.ok).toBe(true);
    if (!createDataResult.ok) throw new Error("Test setup failed");
  });
  afterAll(async (_c) => {});

  it("can read user profile after owning data", async ({ c }) => {
    const { user, expect, userSigner } = c;

    // Now the user should have a profile
    const result = await user.getProfile();
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("Test setup failed");
    expect(result.data.data._id).toBe((await userSigner.getDid()).didString);

    // createOwnedData results in create data log and grant access log for each item
    expect(result.data.data.logs).toHaveLength(10); // 5 docs * (1 create + 1 grant)
  });

  it("can list user data references with default pagination", async ({ c }) => {
    const { user, expect } = c;

    const result = await user.listDataReferences();

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("Test setup failed");
    expect(result.data.data).toHaveLength(5);
    expect(result.data.pagination.total).toBe(5);
    expect(result.data.pagination.limit).toBe(1_000); // Default limit
    expect(result.data.pagination.offset).toBe(0); // Default offset
  });

  it("can list user data references with explicit pagination", async ({ c }) => {
    const { user, expect } = c;

    const result = await user.listDataReferences({
      limit: 2,
      offset: 3,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("Test setup failed");
    expect(result.data.data).toHaveLength(2);
    expect(result.data.pagination.total).toBe(5);
    expect(result.data.pagination.limit).toBe(2);
    expect(result.data.pagination.offset).toBe(3);
  });
});
