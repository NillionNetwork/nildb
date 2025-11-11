import { faker } from "@faker-js/faker";
import { PathsV1 } from "@nillion/nildb-types";
import { Builder, Did } from "@nillion/nuc";
import { StatusCodes } from "http-status-codes";
import { describe } from "vitest";
import { createTestFixtureExtension } from "../fixture/it.js";

describe("02-builder-lifecycle.test.js", () => {
  const { it, beforeAll, afterAll } = createTestFixtureExtension();

  beforeAll(async (_c) => {});
  afterAll(async (_c) => {});

  it("routes reject requests without any authentication", async ({ c }) => {
    const { expect } = c;
    const response = await c.app.request(PathsV1.collections.root);
    expect(response.status).toBe(StatusCodes.UNAUTHORIZED);
  });

  it("self-signed tokens are rejected from paid route", async ({ c }) => {
    const { expect, app, builderSigner, bindings } = c;

    const builderDid = await builderSigner.getDid();
    const selfSignedToken = await Builder.invocation()
      .command("/nil/db")
      .audience(bindings.node.did)
      .subject(builderDid)
      .signAndSerialize(builderSigner);

    const response = await app.request(PathsV1.collections.root, {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${selfSignedToken}`,
      },
    });
    expect(response.status).toBe(StatusCodes.PAYMENT_REQUIRED);
  });

  it("builder can access paid routes", async ({ c }) => {
    const { builder } = c;
    const result = await builder.readCollections();
    c.expect(result.ok).toBe(true);
  });

  it("rejects registration of a builder with a duplicate DID", async ({
    c,
  }) => {
    const { expect, builder, builderSigner } = c;
    const builderDid = await builderSigner.getDid();
    const builderName = faker.person.fullName();

    // The first registration is done by the test fixture so a second registration should fail.
    const result = await builder.register({
      did: builderDid.didString,
      name: builderName,
    });

    expect(result.ok).toBe(false);
  });

  it("builder can read its profile", async ({ c }) => {
    const { builder, builderSigner, expect } = c;
    const result = await builder.getProfile();
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.data._id).toBe(
        Did.serialize(await builderSigner.getDid()),
      );
    }
  });

  it("builder can update its profile", async ({ c }) => {
    const { builder, expect } = c;
    const newName = faker.company.name();
    const updateResult = await builder.updateProfile({ name: newName });
    expect(updateResult.ok).toBe(true);
    const getResult = await builder.getProfile();
    expect(getResult.ok).toBe(true);
    if (getResult.ok) {
      expect(getResult.data.data.name).toBe(newName);
    }
  });

  it("builder can be removed", async ({ c }) => {
    const { expect, builder } = c;
    const deleteResult = await builder.deleteBuilder();
    expect(deleteResult.ok).toBe(true);

    const getProfileResult = await builder.getProfile();
    expect(getProfileResult.ok).toBe(false);
    if (!getProfileResult.ok) {
      expect(getProfileResult.status).toBeDefined();
    }

    const readCollectionsResult = await builder.readCollections();
    expect(readCollectionsResult.ok).toBe(false);
    if (!readCollectionsResult.ok) {
      expect(readCollectionsResult.status).toBeDefined();
    }

    const getQueriesResult = await builder.getQueries();
    expect(getQueriesResult.ok).toBe(false);
    if (!getQueriesResult.ok) {
      expect(getQueriesResult.status).toBeDefined();
    }
  });
});
