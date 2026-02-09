import { faker } from "@faker-js/faker";
import type { BuilderDocument } from "@nildb/builders/builders.types";
import { CollectionName } from "@nildb/common/mongo";
// oxlint-disable-next-line import/extensions
import { secp256k1 } from "@noble/curves/secp256k1.js";
// oxlint-disable-next-line import/extensions
import { bytesToHex } from "@noble/hashes/utils.js";
import { StatusCodes } from "http-status-codes";
import { ObjectId } from "mongodb";
import { describe } from "vitest";

import { NilauthClient } from "@nillion/nilauth-client";
import { BuilderClient } from "@nillion/nildb-client";
import { createUuidDto, PathsV1 } from "@nillion/nildb-types";
import { Did, Signer } from "@nillion/nuc";

import type { CreditFixtureContext } from "../fixture/fixture";
import { createCreditTestFixtureExtension } from "../fixture/it";
import { activateSubscriptionWithPayment } from "../fixture/payment";

describe("10-dual-mode.test.ts", () => {
  const { it, beforeAll, afterAll } = createCreditTestFixtureExtension();

  let nilauthBuilder: BuilderClient;

  beforeAll(async (c: CreditFixtureContext) => {
    // Register a nilauth builder alongside the credit builder.
    // This builder uses the existing nilauth subscription flow.
    const { app, bindings } = c;

    const builderPrivateKey = bytesToHex(secp256k1.utils.randomSecretKey());
    const builderSigner = Signer.fromPrivateKey(builderPrivateKey);
    const builderDid = await builderSigner.getDid();

    const nilauth = await NilauthClient.create({
      baseUrl: bindings.config.nilauthInstances[0].baseUrl,
      chainId: bindings.config.nilauthChainId,
    });

    nilauthBuilder = new BuilderClient({
      baseUrl: bindings.config.nodePublicEndpoint,
      signer: builderSigner,
      nodePublicKey: bindings.node.publicKey,
      nilauth,
      httpClient: app.request,
    });

    // Activate subscription via nilauth payment on Anvil
    const anvilRpcUrl = process.env.APP_ANVIL_RPC_URL || "http://127.0.0.1:30545";
    await activateSubscriptionWithPayment(nilauth, builderDid, anvilRpcUrl);

    // Register builder via API — nilauth builders use did:key which normalizeIdentifier preserves.
    // However, with credits enabled, did:key registration is blocked.
    // So we insert the nilauth builder directly into DB without creditsUsd (nilauth mode).
    const canonicalDid = Did.serialize(builderDid);
    const now = new Date();
    const builderDoc: BuilderDocument = {
      _id: new ObjectId(),
      did: canonicalDid,
      _created: now,
      _updated: now,
      name: faker.person.fullName(),
      collections: [],
      queries: [],
      // No creditsUsd field — this builder uses nilauth auth
    };
    await bindings.db.primary.collection<BuilderDocument>(CollectionName.Builders).insertOne(builderDoc);
  });

  afterAll(async (_c) => {});

  it("nilauth builder works when credits flag is on", async ({ c }) => {
    const { expect } = c;

    // Nilauth builder should have full access (no credit gating since creditsUsd is undefined)
    const result = await nilauthBuilder.readCollections();
    expect(result.ok).toBe(true);
  });

  it("credit builder works independently", async ({ c }) => {
    const { expect, app, creditBuilder } = c;

    const token = await creditBuilder.createToken("/nil/db/collections/read");
    const response = await app.request(PathsV1.collections.root, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    expect(response.status).toBe(StatusCodes.OK);
  });

  it("nilauth builder can create a collection", async ({ c }) => {
    const { expect } = c;

    const result = await nilauthBuilder.createCollection({
      _id: createUuidDto(),
      type: "standard",
      name: `nilauth-coll-${Date.now()}`,
      schema: {},
    });
    expect(result.ok).toBe(true);
  });

  it("credit builder can create a collection (as free tier)", async ({ c }) => {
    const { expect, app, creditBuilder } = c;

    const token = await creditBuilder.createToken("/nil/db/collections");
    const response = await app.request(PathsV1.collections.root, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        _id: createUuidDto(),
        type: "standard",
        name: `credit-coll-${Date.now()}`,
        schema: {},
      }),
    });
    expect(response.status).toBe(StatusCodes.CREATED);
  });

  it("both builders see only their own collections", async ({ c }) => {
    const { expect, app, creditBuilder } = c;

    // Nilauth builder sees its collections
    const nilauthResult = await nilauthBuilder.readCollections();
    expect(nilauthResult.ok).toBe(true);
    if (nilauthResult.ok) {
      const names = nilauthResult.data.data.map((col: { name: string }) => col.name);
      expect(names.some((n: string) => n.startsWith("nilauth-coll-"))).toBe(true);
      expect(names.some((n: string) => n.startsWith("credit-coll-"))).toBe(false);
    }

    // Credit builder sees its collections
    const token = await creditBuilder.createToken("/nil/db/collections/read");
    const response = await app.request(PathsV1.collections.root, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    expect(response.status).toBe(StatusCodes.OK);
    const body = (await response.json()) as { data: Array<{ name: string }> };
    const creditNames = body.data.map((col) => col.name);
    expect(creditNames.some((n: string) => n.startsWith("credit-coll-"))).toBe(true);
    expect(creditNames.some((n: string) => n.startsWith("nilauth-coll-"))).toBe(false);
  });

  it("unauthenticated registration returns 401", async ({ c }) => {
    const { expect, app } = c;

    const response = await app.request(PathsV1.builders.register, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        did: "did:key:z6MkhaXgBZDvotDkL5257faiztiGiC2QtKLGpbnnEGta2doK",
        name: "should-fail",
      }),
    });
    expect(response.status).toBe(StatusCodes.UNAUTHORIZED);
  });
});
