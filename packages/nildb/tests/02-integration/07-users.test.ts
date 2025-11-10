import { createUuidDto } from "@nillion/nildb-types";
import { describe } from "vitest";
import simpleCollection from "../data/simple.collection.json";
import simpleQuery from "../data/simple.query.json";
import { createTestFixtureExtension } from "../fixture/it.js";

describe("User Endpoints", () => {
  const { it, beforeAll, afterAll } = createTestFixtureExtension();

  beforeAll(async (c) => {
    const { builder, user } = c;

    simpleCollection._id = createUuidDto();
    simpleQuery._id = createUuidDto();
    simpleQuery.collection = simpleCollection._id;

    await builder
      .createCollection(c, {
        _id: simpleCollection._id,
        type: "owned",
        name: simpleCollection.name,
        schema: simpleCollection.schema,
      })
      .expectSuccess();

    // Add multiple data documents for the user to enable pagination testing
    const dataToCreate = Array.from({ length: 5 }, () => ({
      _id: createUuidDto(),
      name: "user-data-item",
    }));

    await builder
      .createOwnedData(c, {
        owner: (await user.getDid()).didString,
        collection: simpleCollection._id,
        data: dataToCreate,
        acl: {
          grantee: (await builder.getDid()).didString,
          read: true,
          write: false,
          execute: false,
        },
      })
      .expectSuccess();
  });
  afterAll(async (_c) => {});

  it("can read user profile after owning data", async ({ c }) => {
    const { user, expect } = c;

    // Now the user should have a profile
    const result = await user.getProfile(c).expectSuccess();
    expect(result.data._id).toBe((await user.getDid()).didString);

    // createOwnedData results in create data log and grant access log for each item
    expect(result.data.logs).toHaveLength(10); // 5 docs * (1 create + 1 grant)
  });

  it("can list user data references with default pagination", async ({ c }) => {
    const { user, expect } = c;

    const { data, pagination } = await user
      .listDataReferences(c)
      .expectSuccess();

    expect(data).toHaveLength(5);
    expect(pagination.total).toBe(5);
    expect(pagination.limit).toBe(1_000); // Default limit
    expect(pagination.offset).toBe(0); // Default offset
  });

  it("can list user data references with explicit pagination", async ({
    c,
  }) => {
    const { user, expect } = c;

    const { data, pagination } = await user
      .listDataReferences(c, { limit: 2, offset: 3 })
      .expectSuccess();

    expect(data).toHaveLength(2);
    expect(pagination.total).toBe(5);
    expect(pagination.limit).toBe(2);
    expect(pagination.offset).toBe(3);
  });
});
