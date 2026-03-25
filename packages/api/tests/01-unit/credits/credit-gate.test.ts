import type { BuilderDocument } from "@nildb/builders/builders.types";
import { type OperationType, requireCredits } from "@nildb/middleware/credit-gate.middleware";
import { ObjectId } from "mongodb";
import { describe, expect, it, vi } from "vitest";

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

type MockContext = {
  env: {
    config: {
      enabledFeatures: string[];
      freeTierBytes: number;
      gracePeriodDays: number;
    };
    log: { debug: ReturnType<typeof vi.fn> };
  };
  get: (key: string) => unknown;
  json: ReturnType<typeof vi.fn>;
  text: ReturnType<typeof vi.fn>;
  header: ReturnType<typeof vi.fn>;
};

function createMockContext(builder: BuilderDocument, features: string[]): MockContext {
  return {
    env: {
      config: {
        enabledFeatures: features,
        freeTierBytes: 104857600,
        gracePeriodDays: 90,
      },
      log: { debug: vi.fn() },
    },
    get: (key: string) => {
      if (key === "builder") return builder;
      return undefined;
    },
    json: vi.fn().mockReturnValue(new Response()),
    text: vi.fn().mockReturnValue(new Response()),
    header: vi.fn(),
  };
}

async function runMiddleware(
  operation: OperationType,
  builder: BuilderDocument,
  features: string[],
): Promise<{ passedThrough: boolean; context: MockContext }> {
  const middleware = requireCredits(operation);
  const context = createMockContext(builder, features);
  let passedThrough = false;
  const next = async (): Promise<void> => {
    passedThrough = true;
  };

  await middleware(context as any, next);
  return { passedThrough, context };
}

describe("requireCredits middleware", () => {
  describe("when CREDITS feature flag is off", () => {
    const features = ["openapi", "migrations"];

    it("passes through for any operation", async () => {
      const builder = makeBuilder({ creditsUsd: 0, storageBytes: 200 * 1024 * 1024 });
      const { passedThrough } = await runMiddleware("write", builder, features);
      expect(passedThrough).toBe(true);
    });
  });

  describe("when CREDITS is on but builder has no creditsUsd field", () => {
    const features = ["openapi", "migrations", "credits"];

    it("passes through (gating skipped for builders without creditsUsd)", async () => {
      const builder = makeBuilder(); // no creditsUsd field
      const { passedThrough } = await runMiddleware("write", builder, features);
      expect(passedThrough).toBe(true);
    });
  });

  describe("when CREDITS is on and builder has credits", () => {
    const features = ["openapi", "migrations", "credits"];

    const statusCases: Array<{
      status: string;
      storageBytes: number;
      creditsUsd: number;
      creditsDepleted?: Date | null;
      allowed: OperationType[];
      denied: OperationType[];
    }> = [
      {
        status: "free_tier (under limit)",
        storageBytes: 50 * 1024 * 1024,
        creditsUsd: 0,
        allowed: ["read", "write", "execute"],
        denied: [],
      },
      {
        status: "active",
        storageBytes: 200 * 1024 * 1024,
        creditsUsd: 10,
        allowed: ["read", "write", "execute"],
        denied: [],
      },
      {
        status: "warning (just depleted)",
        storageBytes: 200 * 1024 * 1024,
        creditsUsd: 0,
        creditsDepleted: new Date(Date.now() - 48 * 60 * 60 * 1000),
        allowed: ["read", "write", "execute"],
        denied: [],
      },
      {
        status: "read_only",
        storageBytes: 200 * 1024 * 1024,
        creditsUsd: 0,
        creditsDepleted: new Date(Date.now() - 100 * 60 * 60 * 1000),
        allowed: ["read"],
        denied: ["write", "execute"],
      },
      {
        status: "suspended",
        storageBytes: 200 * 1024 * 1024,
        creditsUsd: 0,
        creditsDepleted: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
        allowed: [],
        denied: ["read", "write", "execute"],
      },
      {
        status: "pending_purge",
        storageBytes: 200 * 1024 * 1024,
        creditsUsd: 0,
        creditsDepleted: new Date(Date.now() - 100 * 24 * 60 * 60 * 1000),
        allowed: [],
        denied: ["read", "write", "execute"],
      },
    ];

    for (const { status, storageBytes, creditsUsd, creditsDepleted, allowed, denied } of statusCases) {
      for (const op of allowed) {
        it(`allows ${op} when builder is ${status}`, async () => {
          const builder = makeBuilder({ storageBytes, creditsUsd, creditsDepleted });
          const { passedThrough } = await runMiddleware(op, builder, features);
          expect(passedThrough).toBe(true);
        });
      }

      for (const op of denied) {
        it(`denies ${op} when builder is ${status}`, async () => {
          const builder = makeBuilder({ storageBytes, creditsUsd, creditsDepleted });
          const { passedThrough, context } = await runMiddleware(op, builder, features);
          expect(passedThrough).toBe(false);
          expect(context.json).toHaveBeenCalled();
        });
      }
    }

    it("adds X-Credits-Warning header when builder is in warning status", async () => {
      const builder = makeBuilder({
        storageBytes: 200 * 1024 * 1024,
        creditsUsd: 0,
        creditsDepleted: new Date(Date.now() - 48 * 60 * 60 * 1000),
      });
      const { passedThrough, context } = await runMiddleware("read", builder, features);
      expect(passedThrough).toBe(true);
      expect(context.header).toHaveBeenCalledWith("X-Credits-Warning", expect.any(String));
    });
  });
});
