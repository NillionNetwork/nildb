import { describe } from "vitest";
import { createTestFixtureExtension } from "../fixture/it.js";

describe("rate-limiting.test.js", () => {
  process.env.APP_RATE_LIMIT_ENABLED = "true";
  process.env.APP_RATE_LIMIT_WINDOW_SECONDS = "10";
  process.env.APP_RATE_LIMIT_MAX_REQUESTS = "5";

  const { it, beforeAll, afterAll } = createTestFixtureExtension();
  beforeAll(async (_c) => {});
  afterAll(async (_c) => {});

  it("should block requests that exceed the configured rate limit", async ({
    c,
  }) => {
    const { expect, system } = c;
    const maxRequests = Number(process.env.APP_RATE_LIMIT_MAX_REQUESTS);

    // Make requests up to the limit, which should all succeed
    for (let i = 0; i < maxRequests - 1; i++) {
      const result = await system.health();
      expect(result.ok).toBe(true);
    }

    // The next request should be blocked
    const result = await system.health();
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBeDefined();
    }
  });
});
