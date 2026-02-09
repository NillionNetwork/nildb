import type { BuilderDocument } from "@nildb/builders/builders.types";
import { computeStatus } from "@nildb/credits/credits.services";
import { ObjectId } from "mongodb";
import { describe, expect, it } from "vitest";

function makeBuilder(overrides: Partial<BuilderDocument> = {}): BuilderDocument {
  const now = new Date();
  return {
    _id: new ObjectId(),
    did: "did:key:z6Mktest",
    _created: now,
    _updated: now,
    name: "test-builder",
    collections: [],
    queries: [],
    ...overrides,
  };
}

const config = { freeTierBytes: 104857600, gracePeriodDays: 90 }; // 100MB free tier

describe("computeStatus", () => {
  it("returns free_tier when storage is under the free tier limit", () => {
    const builder = makeBuilder({ storageBytes: 50 * 1024 * 1024, creditsUsd: 0 });
    expect(computeStatus(builder, config)).toBe("free_tier");
  });

  it("returns free_tier when storage equals the free tier limit", () => {
    const builder = makeBuilder({ storageBytes: 104857600, creditsUsd: 0 });
    expect(computeStatus(builder, config)).toBe("free_tier");
  });

  it("returns active when over free tier with credits", () => {
    const builder = makeBuilder({ storageBytes: 200 * 1024 * 1024, creditsUsd: 10 });
    expect(computeStatus(builder, config)).toBe("active");
  });

  it("returns warning when credits depleted is null (just ran out)", () => {
    const builder = makeBuilder({
      storageBytes: 200 * 1024 * 1024,
      creditsUsd: 0,
      creditsDepleted: null,
    });
    expect(computeStatus(builder, config)).toBe("warning");
  });

  it("returns warning when credits depleted is undefined", () => {
    const builder = makeBuilder({
      storageBytes: 200 * 1024 * 1024,
      creditsUsd: 0,
    });
    expect(computeStatus(builder, config)).toBe("warning");
  });

  it("returns warning when credits depleted within 72 hours", () => {
    const builder = makeBuilder({
      storageBytes: 200 * 1024 * 1024,
      creditsUsd: 0,
      creditsDepleted: new Date(Date.now() - 48 * 60 * 60 * 1000),
    });
    expect(computeStatus(builder, config)).toBe("warning");
  });

  it("returns read_only when credits depleted between 72h and 1 week", () => {
    const builder = makeBuilder({
      storageBytes: 200 * 1024 * 1024,
      creditsUsd: 0,
      creditsDepleted: new Date(Date.now() - 100 * 60 * 60 * 1000),
    });
    expect(computeStatus(builder, config)).toBe("read_only");
  });

  it("returns suspended when credits depleted between 1 week and grace period", () => {
    const builder = makeBuilder({
      storageBytes: 200 * 1024 * 1024,
      creditsUsd: 0,
      creditsDepleted: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
    });
    expect(computeStatus(builder, config)).toBe("suspended");
  });

  it("returns pending_purge when credits depleted beyond grace period", () => {
    const builder = makeBuilder({
      storageBytes: 200 * 1024 * 1024,
      creditsUsd: 0,
      creditsDepleted: new Date(Date.now() - 100 * 24 * 60 * 60 * 1000),
    });
    expect(computeStatus(builder, config)).toBe("pending_purge");
  });

  it("returns free_tier when storageBytes is undefined", () => {
    const builder = makeBuilder({ creditsUsd: 0 });
    expect(computeStatus(builder, config)).toBe("free_tier");
  });

  it("returns free_tier when creditsUsd is undefined and no storage", () => {
    const builder = makeBuilder({});
    expect(computeStatus(builder, config)).toBe("free_tier");
  });
});
