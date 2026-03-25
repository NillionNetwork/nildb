import type { BuilderDocument } from "@nildb/builders/builders.types";
import type { CollectionDocument } from "@nildb/collections/collections.types";
import { CollectionName } from "@nildb/common/mongo";
import { runBillingCycle } from "@nildb/workers/billing.worker";
import { runPurgeCycle } from "@nildb/workers/purge.worker";
import { StatusCodes } from "http-status-codes";
import { ObjectId, UUID } from "mongodb";
import { describe, expect } from "vitest";

import type {
  AdminCreditTopUpResponse,
  AdminUpdatePricingResponse,
  ReadCreditsResponse,
  ReadPricingResponse,
} from "@nillion/nildb-types";
import { createUuidDto, PathsV1 } from "@nillion/nildb-types";

import { createTestFixtureExtension } from "../fixture/it";

describe("09-credits.test.ts", () => {
  const { it, beforeAll, afterAll } = createTestFixtureExtension();
  beforeAll(async (_c) => {});
  afterAll(async (_c) => {});

  it("GET /v1/credits/pricing returns pricing info", async ({ c }) => {
    const { app } = c;

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
    const { app, createToken } = c;
    const token = await createToken("/nil/db/credits/read");

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
    const { app, createToken } = c;
    const token = await createToken("/nil/db/credits/read");

    const response = await app.request(PathsV1.credits.root, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    const body = (await response.json()) as ReadCreditsResponse;
    expect(body.data.status).toBe("free_tier");
  });

  it("credit builder can read collections (free tier access)", async ({ c }) => {
    const { app, createToken } = c;
    const token = await createToken("/nil/db/collections/read");

    const response = await app.request(PathsV1.collections.root, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    expect(response.status).toBe(StatusCodes.OK);
  });

  it("credit builder with read_only status cannot write", async ({ c }) => {
    const { app, bindings, builderDid, createToken } = c;

    // Set builder to have storage over free tier with depleted credits (100+ hours ago → read_only)
    await bindings.db.primary.collection<BuilderDocument>(CollectionName.Builders).updateOne(
      { did: builderDid },
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
    bindings.cache.builders.delete(builderDid);

    const token = await createToken("/nil/db/collections");

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
    const readToken = await createToken("/nil/db/collections/read");
    const readResponse = await app.request(PathsV1.collections.root, {
      headers: {
        Authorization: `Bearer ${readToken}`,
      },
    });
    expect(readResponse.status).toBe(StatusCodes.OK);
  });

  it("credit builder with suspended status cannot read or write", async ({ c }) => {
    const { app, bindings, builderDid, createToken } = c;

    // Set builder to suspended (10+ days without credits)
    await bindings.db.primary.collection<BuilderDocument>(CollectionName.Builders).updateOne(
      { did: builderDid },
      {
        $set: {
          storageBytes: 200 * 1024 * 1024,
          creditsUsd: 0,
          creditsDepleted: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
          status: "suspended",
        },
      },
    );
    bindings.cache.builders.delete(builderDid);

    const token = await createToken("/nil/db/collections/read");
    const response = await app.request(PathsV1.collections.root, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    expect(response.status).toBe(StatusCodes.PAYMENT_REQUIRED);
  });

  it("adding credits restores access for a degraded builder", async ({ c }) => {
    const { app, bindings, builderDid, createToken } = c;

    // Give the builder credits and restore active status
    await bindings.db.primary.collection<BuilderDocument>(CollectionName.Builders).updateOne(
      { did: builderDid },
      {
        $set: {
          creditsUsd: 10,
          creditsDepleted: null,
          status: "active",
        },
      },
    );
    bindings.cache.builders.delete(builderDid);

    const token = await createToken("/nil/db/collections/read");
    const response = await app.request(PathsV1.collections.root, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    expect(response.status).toBe(StatusCodes.OK);
  });

  // --- Billing worker tests ---

  it("billing cycle deducts credits for storage over free tier", async ({ c }) => {
    const { bindings, builderDid } = c;
    const builders = bindings.db.primary.collection<BuilderDocument>(CollectionName.Builders);

    // Create a collection in the data DB with some documents so $collStats returns storage
    const collectionUuid = new UUID(createUuidDto());
    const collectionName = collectionUuid.toString();
    const dataCollection = bindings.db.data.collection(collectionName);
    const docs = Array.from({ length: 100 }, (_, i) => ({
      _id: new ObjectId(),
      value: `data-${i}`,
      padding: "x".repeat(1024),
    }));
    await dataCollection.insertMany(docs);

    // Set builder with credits and add the collection, last billed 2 hours ago
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
    await builders.updateOne(
      { did: builderDid },
      {
        $set: {
          creditsUsd: 10,
          creditsDepleted: null,
          status: "active",
          lastBillingCycle: twoHoursAgo,
          storageBytes: 0,
        },
        $addToSet: { collections: collectionUuid },
      },
    );
    bindings.cache.builders.delete(builderDid);

    // Temporarily set free tier to 0 so any storage is billable
    const originalFreeTier = bindings.config.freeTierBytes;
    bindings.config.freeTierBytes = 0;

    try {
      await runBillingCycle(bindings);

      const builder = await builders.findOne({ did: builderDid });
      expect(builder).not.toBeNull();
      expect(builder!.creditsUsd).toBeLessThan(10);
      expect(builder!.lastBillingCycle).toBeDefined();
      expect(builder!.lastBillingCycle!.getTime()).toBeGreaterThan(twoHoursAgo.getTime());
      expect(builder!.storageBytes).toBeGreaterThan(0);
    } finally {
      bindings.config.freeTierBytes = originalFreeTier;
      // Clean up the test collection
      await dataCollection.drop();
      await builders.updateOne({ did: builderDid }, { $pull: { collections: collectionUuid } });
      bindings.cache.builders.delete(builderDid);
    }
  });

  it("billing cycle does not deduct for free tier storage", async ({ c }) => {
    const { bindings, builderDid } = c;
    const builders = bindings.db.primary.collection<BuilderDocument>(CollectionName.Builders);

    // Set builder with credits, no collections (0 storage), last billed 2 hours ago
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
    await builders.updateOne(
      { did: builderDid },
      {
        $set: {
          creditsUsd: 10,
          creditsDepleted: null,
          status: "active",
          lastBillingCycle: twoHoursAgo,
          storageBytes: 0,
          collections: [],
        },
      },
    );
    bindings.cache.builders.delete(builderDid);

    await runBillingCycle(bindings);

    const builder = await builders.findOne({ did: builderDid });
    expect(builder).not.toBeNull();
    // No storage means no cost — credits unchanged
    expect(builder!.creditsUsd).toBe(10);
    // lastBillingCycle still updated (storage snapshot always updates)
    expect(builder!.lastBillingCycle!.getTime()).toBeGreaterThan(twoHoursAgo.getTime());
  });

  it("billing cycle sets creditsDepleted when balance hits zero", async ({ c }) => {
    const { bindings, builderDid } = c;
    const builders = bindings.db.primary.collection<BuilderDocument>(CollectionName.Builders);

    // Create a collection with data
    const collectionUuid = new UUID(createUuidDto());
    const collectionName = collectionUuid.toString();
    const dataCollection = bindings.db.data.collection(collectionName);
    const docs = Array.from({ length: 50 }, (_, i) => ({
      _id: new ObjectId(),
      value: `data-${i}`,
      padding: "x".repeat(1024),
    }));
    await dataCollection.insertMany(docs);

    // Set builder with extremely tiny credits that any billing cost will exhaust
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
    await builders.updateOne(
      { did: builderDid },
      {
        $set: {
          creditsUsd: 1e-20,
          creditsDepleted: null,
          status: "active",
          lastBillingCycle: twoHoursAgo,
          storageBytes: 0,
        },
        $addToSet: { collections: collectionUuid },
      },
    );
    bindings.cache.builders.delete(builderDid);

    const originalFreeTier = bindings.config.freeTierBytes;
    bindings.config.freeTierBytes = 0;

    try {
      await runBillingCycle(bindings);

      const builder = await builders.findOne({ did: builderDid });
      expect(builder).not.toBeNull();
      expect(builder!.creditsUsd).toBe(0);
      expect(builder!.creditsDepleted).toBeInstanceOf(Date);
      expect(builder!.status).toBe("warning");
    } finally {
      bindings.config.freeTierBytes = originalFreeTier;
      await dataCollection.drop();
      await builders.updateOne({ did: builderDid }, { $pull: { collections: collectionUuid } });
      bindings.cache.builders.delete(builderDid);
    }
  });

  it("billing cycle transitions status from warning to read_only", async ({ c }) => {
    const { bindings, builderDid } = c;
    const builders = bindings.db.primary.collection<BuilderDocument>(CollectionName.Builders);

    // Create a collection with data
    const collectionUuid = new UUID(createUuidDto());
    const collectionName = collectionUuid.toString();
    const dataCollection = bindings.db.data.collection(collectionName);
    await dataCollection.insertMany([{ _id: new ObjectId(), value: "test", padding: "x".repeat(1024) }]);

    // Set builder to warning state: credits at 0, depleted 80 hours ago
    const eightyHoursAgo = new Date(Date.now() - 80 * 60 * 60 * 1000);
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
    await builders.updateOne(
      { did: builderDid },
      {
        $set: {
          creditsUsd: 0,
          creditsDepleted: eightyHoursAgo,
          status: "warning",
          lastBillingCycle: twoHoursAgo,
          storageBytes: 200 * 1024 * 1024,
        },
        $addToSet: { collections: collectionUuid },
      },
    );
    bindings.cache.builders.delete(builderDid);

    const originalFreeTier = bindings.config.freeTierBytes;
    bindings.config.freeTierBytes = 0;

    try {
      await runBillingCycle(bindings);

      const builder = await builders.findOne({ did: builderDid });
      expect(builder).not.toBeNull();
      // Storage is billable (freeTier=0), cost > 0, deductCreditsUsd runs, status recomputed
      // With creditsDepleted 80h ago and creditsUsd 0, computeStatus returns read_only
      expect(builder!.status).toBe("read_only");
    } finally {
      bindings.config.freeTierBytes = originalFreeTier;
      await dataCollection.drop();
      await builders.updateOne({ did: builderDid }, { $pull: { collections: collectionUuid } });
      bindings.cache.builders.delete(builderDid);
    }
  });

  // --- GET /v1/credits estimated hours tests ---

  it("GET /v1/credits returns estimatedHoursRemaining when builder has storage and credits", async ({ c }) => {
    const { app, bindings, builderDid, createToken } = c;

    // Set builder with credits and storage above free tier
    const storageBytes = 200 * 1024 * 1024; // 200MB
    await bindings.db.primary.collection<BuilderDocument>(CollectionName.Builders).updateOne(
      { did: builderDid },
      {
        $set: {
          creditsUsd: 1.0,
          storageBytes,
          status: "active",
          creditsDepleted: null,
        },
      },
    );
    bindings.cache.builders.delete(builderDid);

    const token = await createToken("/nil/db/credits/read");
    const response = await app.request(PathsV1.credits.root, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(response.status).toBe(StatusCodes.OK);

    const body = (await response.json()) as ReadCreditsResponse;
    expect(body.data.estimatedHoursRemaining).toBeTypeOf("number");
    expect(body.data.estimatedHoursRemaining).toBeGreaterThan(0);

    // Verify the calculation: billable = storageBytes - freeTier, costPerHour = billableGb * rate
    const { freeTierBytes, storageCostPerGbHour } = bindings.config;
    const billableGb = (storageBytes - freeTierBytes) / (1024 * 1024 * 1024);
    const costPerHour = billableGb * storageCostPerGbHour;
    const expectedHours = 1.0 / costPerHour;
    expect(body.data.estimatedHoursRemaining).toBeCloseTo(expectedHours, 1);
  });

  it("GET /v1/credits returns null estimatedHoursRemaining in free tier", async ({ c }) => {
    const { app, bindings, builderDid, createToken } = c;

    // Set builder with no storage (free tier)
    await bindings.db.primary.collection<BuilderDocument>(CollectionName.Builders).updateOne(
      { did: builderDid },
      {
        $set: {
          creditsUsd: 5.0,
          storageBytes: 0,
          status: "free_tier",
          creditsDepleted: null,
        },
      },
    );
    bindings.cache.builders.delete(builderDid);

    const token = await createToken("/nil/db/credits/read");
    const response = await app.request(PathsV1.credits.root, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(response.status).toBe(StatusCodes.OK);

    const body = (await response.json()) as ReadCreditsResponse;
    expect(body.data.estimatedHoursRemaining).toBeNull();
  });

  // --- Purge worker tests ---

  it("purge cycle deletes builder data after grace period", async ({ c }) => {
    const { bindings } = c;
    const builders = bindings.db.primary.collection<BuilderDocument>(CollectionName.Builders);

    // Create a separate builder for purge testing (don't destroy the main credit builder)
    const purgeBuilderDid = `did:key:z6Mk${crypto.randomUUID().replace(/-/g, "")}`;
    const collectionUuid = new UUID(createUuidDto());
    const collectionName = collectionUuid.toString();

    const now = new Date();
    const hundredDaysAgo = new Date(Date.now() - 100 * 24 * 60 * 60 * 1000);

    // Insert builder with pending_purge status and old creditsDepleted
    await builders.insertOne({
      _id: new ObjectId(),
      did: purgeBuilderDid,
      _created: now,
      _updated: now,
      name: "purge-test-builder",
      collections: [collectionUuid],
      queries: [],
      creditsUsd: 0,
      storageBytes: 1024,
      status: "pending_purge",
      creditsDepleted: hundredDaysAgo,
    });

    // Insert a collection metadata document so deleteBuilderCollections can find and drop it
    await bindings.db.primary.collection<CollectionDocument>(CollectionName.Collections).insertOne({
      _id: collectionUuid,
      _created: now,
      _updated: now,
      owner: purgeBuilderDid,
      name: "purge-test-collection",
      schema: {},
      type: "standard",
    });

    // Create the builder's collection with data in the data DB
    const dataCollection = bindings.db.data.collection(collectionName);
    await dataCollection.insertMany([{ _id: new ObjectId(), value: "will-be-purged" }]);

    await runPurgeCycle(bindings);

    // Verify builder document is deleted
    const builder = await builders.findOne({ did: purgeBuilderDid });
    expect(builder).toBeNull();

    // Verify collection is dropped (listCollections should not include it)
    const collections = await bindings.db.data.listCollections({ name: collectionName }).toArray();
    expect(collections).toHaveLength(0);
  });

  it("purge cycle ignores builders within grace period", async ({ c }) => {
    const { bindings } = c;
    const builders = bindings.db.primary.collection<BuilderDocument>(CollectionName.Builders);

    // Create a builder with pending_purge but within grace period (80 days, grace = 90 days)
    const purgeBuilderDid = `did:key:z6Mk${crypto.randomUUID().replace(/-/g, "")}`;
    const now = new Date();
    const eightyDaysAgo = new Date(Date.now() - 80 * 24 * 60 * 60 * 1000);

    await builders.insertOne({
      _id: new ObjectId(),
      did: purgeBuilderDid,
      _created: now,
      _updated: now,
      name: "grace-period-builder",
      collections: [],
      queries: [],
      creditsUsd: 0,
      storageBytes: 0,
      status: "pending_purge",
      creditsDepleted: eightyDaysAgo,
    });

    await runPurgeCycle(bindings);

    // Builder should still exist — within grace period
    const builder = await builders.findOne({ did: purgeBuilderDid });
    expect(builder).not.toBeNull();

    // Clean up
    await builders.deleteOne({ did: purgeBuilderDid });
  });

  // --- Admin credit topup tests ---

  it("admin topup increases builder balance", async ({ c }) => {
    const { app, bindings, builderDid, createToken, admin } = c;
    const builders = bindings.db.primary.collection<BuilderDocument>(CollectionName.Builders);

    // Set builder with storage above free tier so status reflects credits (not free_tier)
    await builders.updateOne(
      { did: builderDid },
      {
        $set: {
          creditsUsd: 0,
          creditsDepleted: null,
          storageBytes: 200 * 1024 * 1024,
          status: "warning",
        },
      },
    );
    bindings.cache.builders.delete(builderDid);

    const token = await admin.createToken("/nil/db/admin/create");
    const response = await app.request(PathsV1.admin.creditTopUp, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        builderDid: builderDid,
        amountUsd: 5.0,
        reason: "test topup",
      }),
    });
    expect(response.status).toBe(StatusCodes.OK);

    const body = (await response.json()) as AdminCreditTopUpResponse;
    expect(body.data.builderDid).toBe(builderDid);
    expect(body.data.amountUsd).toBe(5);
    expect(body.data.newBalance).toBe(5);
    expect(body.data.status).toBe("active");

    // Verify via GET /v1/credits
    bindings.cache.builders.delete(builderDid);
    const creditsToken = await createToken("/nil/db/credits/read");
    const creditsResponse = await app.request(PathsV1.credits.root, {
      headers: { Authorization: `Bearer ${creditsToken}` },
    });
    const creditsBody = (await creditsResponse.json()) as ReadCreditsResponse;
    expect(creditsBody.data.creditsUsd).toBe(5);
  });

  it("admin topup restores a suspended builder", async ({ c }) => {
    const { app, bindings, builderDid, createToken, admin } = c;
    const builders = bindings.db.primary.collection<BuilderDocument>(CollectionName.Builders);

    // Set builder to suspended state with storage above free tier
    await builders.updateOne(
      { did: builderDid },
      {
        $set: {
          creditsUsd: 0,
          creditsDepleted: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
          storageBytes: 200 * 1024 * 1024,
          status: "suspended",
        },
      },
    );
    bindings.cache.builders.delete(builderDid);

    const token = await admin.createToken("/nil/db/admin/create");
    const response = await app.request(PathsV1.admin.creditTopUp, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        builderDid: builderDid,
        amountUsd: 10.0,
        reason: "restore suspended builder",
      }),
    });
    expect(response.status).toBe(StatusCodes.OK);

    const body = (await response.json()) as AdminCreditTopUpResponse;
    expect(body.data.status).toBe("active");

    // Verify builder can now perform write operations
    bindings.cache.builders.delete(builderDid);
    const writeToken = await createToken("/nil/db/collections");
    const writeResponse = await app.request(PathsV1.collections.root, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${writeToken}`,
      },
      body: JSON.stringify({
        _id: createUuidDto(),
        type: "standard",
        name: "test-collection-after-topup",
        schema: {},
      }),
    });
    expect(writeResponse.status).toBe(StatusCodes.CREATED);
  });

  it("admin topup initialises credits for builder without creditsUsd", async ({ c }) => {
    const { app, bindings, admin } = c;
    const builders = bindings.db.primary.collection<BuilderDocument>(CollectionName.Builders);

    // Insert a builder without creditsUsd field (e.g. a pre-migration builder)
    const noCreditBuilderDid = `did:key:z6Mk${crypto.randomUUID().replace(/-/g, "")}`;
    const now = new Date();
    await builders.insertOne({
      _id: new ObjectId(),
      did: noCreditBuilderDid,
      _created: now,
      _updated: now,
      name: "no-credit-builder",
      collections: [],
      queries: [],
      storageBytes: 0,
    });

    const token = await admin.createToken("/nil/db/admin/create");
    const response = await app.request(PathsV1.admin.creditTopUp, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        builderDid: noCreditBuilderDid,
        amountUsd: 5.0,
        reason: "initialise credits",
      }),
    });
    expect(response.status).toBe(StatusCodes.OK);

    const body = (await response.json()) as { data: { newBalance: number; status: string } };
    expect(body.data.newBalance).toBe(5.0);
    expect(body.data.status).toBe("free_tier");

    // Clean up
    await builders.deleteOne({ did: noCreditBuilderDid });
  });

  it("non-admin token is rejected for topup", async ({ c }) => {
    const { app, builderDid, createToken } = c;

    // Use the builder's signer to create a token with admin command
    const token = await createToken("/nil/db/admin/create");
    const response = await app.request(PathsV1.admin.creditTopUp, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        builderDid: builderDid,
        amountUsd: 5.0,
        reason: "should be rejected",
      }),
    });
    expect(response.status).toBe(StatusCodes.UNAUTHORIZED);
  });

  it("missing auth token is rejected for topup", async ({ c }) => {
    const { app, builderDid } = c;

    const response = await app.request(PathsV1.admin.creditTopUp, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        builderDid: builderDid,
        amountUsd: 5.0,
        reason: "should be rejected",
      }),
    });
    expect(response.status).toBe(StatusCodes.UNAUTHORIZED);
  });

  // --- Admin pricing tests ---

  it("PUT /v1/admin/pricing updates storage cost", async ({ c }) => {
    const { app, bindings, admin } = c;

    const originalCost = bindings.config.storageCostPerGbHour;
    const newCost = 0.0005;

    const token = await admin.createToken("/nil/db/admin/create");
    const response = await app.request(PathsV1.admin.pricing, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ storageCostPerGbHour: newCost }),
    });
    expect(response.status).toBe(StatusCodes.OK);

    const body = (await response.json()) as AdminUpdatePricingResponse;
    expect(body.data.storageCostPerGbHour).toBe(newCost);

    // Verify in-memory config was updated
    expect(bindings.config.storageCostPerGbHour).toBe(newCost);

    // Verify persisted in DB
    const pricingDoc = await bindings.db.primary.collection(CollectionName.Config).findOne({ _type: "pricing" });
    expect(pricingDoc).not.toBeNull();
    expect(pricingDoc!.storageCostPerGbHour).toBe(newCost);

    // Verify GET /v1/credits/pricing reflects the new value
    const pricingResponse = await app.request(PathsV1.credits.pricing);
    const pricingBody = (await pricingResponse.json()) as ReadPricingResponse;
    expect(pricingBody.data.storageCostPerGbHour).toBe(newCost);

    // Restore original cost
    bindings.config.storageCostPerGbHour = originalCost;
    await bindings.db.primary.collection(CollectionName.Config).deleteOne({ _type: "pricing" });
  });

  it("PUT /v1/admin/pricing rejects non-admin tokens", async ({ c }) => {
    const { app, createToken } = c;

    const token = await createToken("/nil/db/admin/create");
    const response = await app.request(PathsV1.admin.pricing, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ storageCostPerGbHour: 0.001 }),
    });
    expect(response.status).toBe(StatusCodes.UNAUTHORIZED);
  });

  it("PUT /v1/admin/pricing rejects invalid values", async ({ c }) => {
    const { app, admin } = c;

    const token = await admin.createToken("/nil/db/admin/create");

    // Negative value
    const response = await app.request(PathsV1.admin.pricing, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ storageCostPerGbHour: -1 }),
    });
    expect(response.status).toBe(StatusCodes.BAD_REQUEST);

    // Zero value
    const response2 = await app.request(PathsV1.admin.pricing, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ storageCostPerGbHour: 0 }),
    });
    expect(response2.status).toBe(StatusCodes.BAD_REQUEST);
  });
});
