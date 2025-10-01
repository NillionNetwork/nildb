import { StatusCodes } from "http-status-codes";
import { describe } from "vitest";
import { createTestFixtureExtension } from "#tests/fixture/it";

describe("rate-limiting.test.ts", () => {
  process.env.APP_RATE_LIMIT_ENABLED = "true";
  process.env.APP_RATE_LIMIT_WINDOW_SECONDS = "10";
  process.env.APP_RATE_LIMIT_MAX_REQUESTS = "5";

  const { it, beforeAll, afterAll } = createTestFixtureExtension();
  beforeAll(async (_c) => {});
  afterAll(async (_c) => {});

  it("should block requests that exceed the configured rate limit", async ({
    c,
  }) => {
    const { system } = c;
    const maxRequests = Number(process.env.APP_RATE_LIMIT_MAX_REQUESTS);

    // Make requests up to the limit, which should all succeed
    for (let i = 0; i < maxRequests - 1; i++) {
      await system.health(c).expectSuccess();
    }

    // The next request should be blocked
    await system.health(c).expectStatusCode(StatusCodes.TOO_MANY_REQUESTS);
  });
});
