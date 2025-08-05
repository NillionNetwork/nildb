import { faker } from "@faker-js/faker";
import { Did } from "@nillion/nuc";
import { StatusCodes } from "http-status-codes";
import { describe } from "vitest";
import collectionJson from "./data/simple.collection.json";
import queryJson from "./data/simple.query.json";
import type { CollectionFixture, QueryFixture } from "./fixture/fixture";
import { createTestFixtureExtension } from "./fixture/it";

describe("builders.test.ts", () => {
  const collection = collectionJson as unknown as CollectionFixture;
  const query = queryJson as unknown as QueryFixture;

  const { it, beforeAll, afterAll } = createTestFixtureExtension({
    collection,
    query,
  });

  beforeAll(async (_c) => {});
  afterAll(async (_c) => {});

  it("builder can read its profile", async ({ c }) => {
    const { builder } = c;
    const { data } = await builder.getProfile(c).expectSuccess();
    c.expect(data._id).toBe(Did.serialize(builder.did));
  });

  it("builder can update its profile", async ({ c }) => {
    const { builder } = c;
    const newName = faker.company.name();
    await builder.updateProfile(c, { name: newName }).expectSuccess();
    const { data } = await builder.getProfile(c).expectSuccess();
    c.expect(data.name).toBe(newName);
  });

  it("builder can be removed", async ({ c }) => {
    const { builder } = c;
    await builder.deleteBuilder(c).expectSuccess();
    await builder.getProfile(c).expectStatusCode(StatusCodes.UNAUTHORIZED);
    await builder.readCollections(c).expectStatusCode(StatusCodes.UNAUTHORIZED);
    await builder.getQueries(c).expectStatusCode(StatusCodes.UNAUTHORIZED);
  });
});
