import { describe } from "vitest";
import { createUuidDto } from "#/common/types";
import simpleCollection from "#tests/data/simple.collection.json";
import simpleQuery from "#tests/data/simple.query.json";
import { createTestFixtureExtension } from "#tests/fixture/it";

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

    // Add some test data to the collection
    await builder
      .createOwnedData(c, {
        owner: user.did.didString,
        collection: simpleCollection._id,
        data: [{ _id: createUuidDto(), name: "name1" }],
        acl: {
          grantee: builder.did.didString,
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
    expect(result.data._id).toBe(user.did.didString);

    // createOwnedData results in two log events: create data and grant access
    expect(result.data.logs).toHaveLength(2);
  });
});
