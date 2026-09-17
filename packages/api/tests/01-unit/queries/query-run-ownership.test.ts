import { findRunByIdWithPaginatedResults, toRunQueryJobDocument } from "@nildb/queries/queries.jobs.repository";
import { Effect as E } from "effect";
import { UUID } from "mongodb";
import { describe, expect, it, vi } from "vitest";

const { mockAggregate } = vi.hoisted(() => ({ mockAggregate: vi.fn() }));

vi.mock("@nildb/common/mongo", async (importOriginal) => {
  const original = await importOriginal<typeof import("@nildb/common/mongo")>();
  return {
    ...original,
    checkCollectionExists: (): E.Effect<{ aggregate: typeof mockAggregate }> => E.succeed({ aggregate: mockAggregate }),
  };
});

describe("query-run ownership", () => {
  it("stores the query owner on new runs", () => {
    const run = toRunQueryJobDocument(new UUID(), "did:key:zowner");

    expect(run.owner).toBe("did:key:zowner");
  });

  it("matches both run id and authenticated owner", async () => {
    const runId = new UUID();
    mockAggregate.mockReturnValue({ next: vi.fn().mockResolvedValue(null) });

    await E.runPromise(findRunByIdWithPaginatedResults({} as never, runId, "did:key:zowner", { limit: 10, offset: 0 }));

    const pipeline = mockAggregate.mock.calls[0][0];
    expect(pipeline[0]).toEqual({ $match: { _id: runId, owner: "did:key:zowner" } });
  });
});
