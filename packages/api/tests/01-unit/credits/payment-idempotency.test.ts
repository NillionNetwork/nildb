import { applyPaymentCreditsAndActivate } from "@nildb/builders/builders.repository";
import { Effect as E } from "effect";
import { ObjectId } from "mongodb";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { collection, mockDelete } = vi.hoisted(() => ({
  collection: {
    findOne: vi.fn(),
    updateOne: vi.fn(),
  },
  mockDelete: vi.fn(),
}));

vi.mock("@nildb/common/mongo", async (importOriginal) => {
  const original = await importOriginal<typeof import("@nildb/common/mongo")>();
  return {
    ...original,
    checkCollectionExists: (): E.Effect<typeof collection> => E.succeed(collection),
  };
});

const builderDid = "did:key:zbuilder";
const ctx = { cache: { builders: { delete: mockDelete } } } as never;

describe("applyPaymentCreditsAndActivate", () => {
  beforeEach(() => {
    collection.findOne.mockReset();
    collection.updateOne.mockReset();
    mockDelete.mockReset();
  });

  it("increments a balance only once for concurrent uses of a payment", async () => {
    const paymentId = new ObjectId();
    let applied = false;
    let balance = 0;

    collection.updateOne.mockImplementation(async () => {
      if (applied) return { matchedCount: 0 };
      applied = true;
      balance += 5;
      return { matchedCount: 1 };
    });
    collection.findOne.mockResolvedValue({ did: builderDid, creditedPaymentIds: [paymentId] });

    const results = await Promise.all([
      E.runPromise(applyPaymentCreditsAndActivate(ctx, builderDid, paymentId, 5)),
      E.runPromise(applyPaymentCreditsAndActivate(ctx, builderDid, paymentId, 5)),
    ]);

    expect(results.sort((a, b) => Number(a) - Number(b))).toEqual([false, true]);
    expect(balance).toBe(5);
  });

  it("does not treat a blocked top-up as already applied", async () => {
    const paymentId = new ObjectId();
    collection.updateOne.mockResolvedValue({ matchedCount: 0 });
    collection.findOne.mockResolvedValue({ did: builderDid, status: "purging", creditedPaymentIds: [] });

    await expect(E.runPromise(applyPaymentCreditsAndActivate(ctx, builderDid, paymentId, 5))).rejects.toBeDefined();
  });
});
