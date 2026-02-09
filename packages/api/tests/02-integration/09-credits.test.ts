import type { BuilderDocument } from "@nildb/builders/builders.types";
import { CollectionName } from "@nildb/common/mongo";
import { StatusCodes } from "http-status-codes";
import { describe } from "vitest";

import type { ReadCreditsResponse, ReadPricingResponse } from "@nillion/nildb-types";
import { createUuidDto, PathsV1 } from "@nillion/nildb-types";

import { createCreditTestFixtureExtension } from "../fixture/it";

describe("09-credits.test.ts", () => {
  const { it, beforeAll, afterAll } = createCreditTestFixtureExtension();
  beforeAll(async (_c) => {});
  afterAll(async (_c) => {});

  it("GET /v1/credits/pricing returns pricing info", async ({ c }) => {
    const { expect, app } = c;

    const response = await app.request(PathsV1.credits.pricing);
    expect(response.status).toBe(StatusCodes.OK);

    const body = (await response.json()) as ReadPricingResponse;
    expect(body.data).toBeDefined();
    expect(body.data.storageCostPerGbHour).toBeTypeOf("number");
    expect(body.data.freeTierBytes).toBeTypeOf("number");
    expect(Array.isArray(body.data.supportedChainIds)).toBe(true);
    expect(Array.isArray(body.data.chains)).toBe(true);
    for (const chain of body.data.chains) {
      expect(chain.chainId).toBeTypeOf("number");
      expect(chain.nilTokenAddress).toBeTypeOf("string");
      expect(chain.burnContractAddress).toBeTypeOf("string");
    }
  });

  it("GET /v1/credits returns balance for credit builder", async ({ c }) => {
    const { expect, app, creditBuilder } = c;
    const token = await creditBuilder.createToken("/nil/db/credits/read");

    const response = await app.request(PathsV1.credits.root, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    expect(response.status).toBe(StatusCodes.OK);

    const body = (await response.json()) as ReadCreditsResponse;
    expect(body.data).toBeDefined();
    expect(body.data.creditsUsd).toBe(0);
    expect(body.data.storageBytes).toBe(0);
    expect(body.data.status).toBe("free_tier");
  });

  it("credit builder with zero credits and low storage is free_tier", async ({ c }) => {
    const { expect, app, creditBuilder } = c;
    const token = await creditBuilder.createToken("/nil/db/credits/read");

    const response = await app.request(PathsV1.credits.root, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    const body = (await response.json()) as ReadCreditsResponse;
    expect(body.data.status).toBe("free_tier");
  });

  it("credit builder can read collections (free tier access)", async ({ c }) => {
    const { expect, app, creditBuilder } = c;
    const token = await creditBuilder.createToken("/nil/db/collections/read");

    const response = await app.request(PathsV1.collections.root, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    expect(response.status).toBe(StatusCodes.OK);
  });

  it("credit builder with read_only status cannot write", async ({ c }) => {
    const { expect, app, bindings, creditBuilder } = c;

    // Set builder to have storage over free tier with depleted credits (100+ hours ago → read_only)
    await bindings.db.primary.collection<BuilderDocument>(CollectionName.Builders).updateOne(
      { did: creditBuilder.did },
      {
        $set: {
          storageBytes: 200 * 1024 * 1024,
          creditsUsd: 0,
          creditsDepleted: new Date(Date.now() - 100 * 60 * 60 * 1000),
          status: "read_only",
        },
      },
    );
    // Clear cache so the middleware sees the updated builder
    bindings.cache.builders.delete(creditBuilder.did);

    const token = await creditBuilder.createToken("/nil/db/collections");

    // Write operation should be denied with PAYMENT_REQUIRED
    const writeResponse = await app.request(PathsV1.collections.root, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        _id: createUuidDto(),
        type: "standard",
        name: "test-collection-should-fail",
        schema: {},
      }),
    });
    expect(writeResponse.status).toBe(StatusCodes.PAYMENT_REQUIRED);

    // Read operation should still succeed
    const readToken = await creditBuilder.createToken("/nil/db/collections/read");
    const readResponse = await app.request(PathsV1.collections.root, {
      headers: {
        Authorization: `Bearer ${readToken}`,
      },
    });
    expect(readResponse.status).toBe(StatusCodes.OK);
  });

  it("credit builder with suspended status cannot read or write", async ({ c }) => {
    const { expect, app, bindings, creditBuilder } = c;

    // Set builder to suspended (10+ days without credits)
    await bindings.db.primary.collection<BuilderDocument>(CollectionName.Builders).updateOne(
      { did: creditBuilder.did },
      {
        $set: {
          storageBytes: 200 * 1024 * 1024,
          creditsUsd: 0,
          creditsDepleted: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
          status: "suspended",
        },
      },
    );
    bindings.cache.builders.delete(creditBuilder.did);

    const token = await creditBuilder.createToken("/nil/db/collections/read");
    const response = await app.request(PathsV1.collections.root, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    expect(response.status).toBe(StatusCodes.PAYMENT_REQUIRED);
  });

  it("adding credits restores access for a degraded builder", async ({ c }) => {
    const { expect, app, bindings, creditBuilder } = c;

    // Give the builder credits and restore active status
    await bindings.db.primary.collection<BuilderDocument>(CollectionName.Builders).updateOne(
      { did: creditBuilder.did },
      {
        $set: {
          creditsUsd: 10,
          creditsDepleted: null,
          status: "active",
        },
      },
    );
    bindings.cache.builders.delete(creditBuilder.did);

    const token = await creditBuilder.createToken("/nil/db/collections/read");
    const response = await app.request(PathsV1.collections.root, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    expect(response.status).toBe(StatusCodes.OK);
  });
});
