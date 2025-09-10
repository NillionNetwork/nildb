import { faker } from "@faker-js/faker";
import { Command, Did, NucTokenBuilder } from "@nillion/nuc";
import { StatusCodes } from "http-status-codes";
import { describe } from "vitest";
import { PathsV1 } from "#/common/paths";
import { createTestFixtureExtension } from "#tests/fixture/it";

describe("02-builder-lifecycle.test.ts", () => {
  // Use a fixture, but don't seed it with any collections or queries.
  const { it, beforeAll, afterAll } = createTestFixtureExtension();

  beforeAll(async (_c) => {});
  afterAll(async (_c) => {});

  it("routes reject requests without any authentication", async ({ c }) => {
    const { expect } = c;
    const response = await c.app.request(PathsV1.collections.root);
    expect(response.status).toBe(StatusCodes.UNAUTHORIZED);
  });

  it("self-signed tokens are rejected from paid route", async ({ c }) => {
    const { expect, builder, system } = c;

    const selfSignedToken = NucTokenBuilder.invocation({})
      .command(new Command(["nil", "db"]))
      .audience(Did.fromHex(system.keypair.publicKey("hex")))
      .subject(Did.fromHex(builder.keypair.publicKey("hex")))
      .build(builder.keypair.privateKey());

    const response = await builder.app.request(PathsV1.collections.root, {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${selfSignedToken}`,
      },
    });
    expect(response.status).toBe(StatusCodes.PAYMENT_REQUIRED);
  });

  it("builder can access paid routes with a subscription", async ({ c }) => {
    const { builder } = c;
    await builder.ensureSubscriptionActive();
    await builder.readCollections(c).expectSuccess();
  });

  it("builder can read its profile", async ({ c }) => {
    const { builder, expect } = c;
    const { data } = await builder.getProfile(c).expectSuccess();
    expect(data._id).toBe(builder.did);
  });

  it("builder can update its profile", async ({ c }) => {
    const { builder, expect } = c;
    const newName = faker.company.name();
    await builder.updateProfile(c, { name: newName }).expectSuccess();
    const { data } = await builder.getProfile(c).expectSuccess();
    expect(data.name).toBe(newName);
  });

  it("builder can be removed", async ({ c }) => {
    const { builder } = c;
    await builder.deleteBuilder(c).expectSuccess();
    await builder.getProfile(c).expectStatusCode(StatusCodes.UNAUTHORIZED);
    await builder.readCollections(c).expectStatusCode(StatusCodes.UNAUTHORIZED);
    await builder.getQueries(c).expectStatusCode(StatusCodes.UNAUTHORIZED);
  });
});
