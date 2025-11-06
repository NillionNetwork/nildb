import { getConnInfo } from "@hono/node-server/conninfo";
import type { ControllerOptions } from "@nildb/common/types";
import type { Context, Next } from "hono";
import { rateLimiter } from "hono-rate-limiter";
import { ReasonPhrases, StatusCodes } from "http-status-codes";

/**
 * Applies IP-based rate limiting to protect the service from abuse.
 *
 * This middleware is configurable via environment variables:
 * - `APP_RATE_LIMIT_ENABLED`: Set to "false" to disable. Defaults to true.
 * - `APP_RATE_LIMIT_WINDOW_SECONDS`: The time window in seconds. Defaults to 60.
 * - `APP_RATE_LIMIT_MAX_REQUESTS`: Max requests per IP in the window. Defaults to 100.
 */
export function rateLimitMiddleware(options: ControllerOptions): void {
  const { app, bindings } = options;
  const { config, log } = bindings;

  if (!config.rateLimitEnabled) {
    log.info("Rate limiting is disabled.");
    return;
  }

  log.info(
    {
      window: `${config.rateLimitWindowSeconds}s`,
      limit: config.rateLimitMaxRequests,
    },
    "Request rate limiting enabled",
  );

  const keyGenerator = (c: Context): string => {
    // 1. Prioritize x-forwarded-for for reverse proxy scenarios
    const forwarded = c.req.header("x-forwarded-for");
    if (forwarded) {
      return forwarded.split(",")[0].trim();
    }

    // 2. Fallback to socket address for direct connections
    //    `getConnInfo` throws in test environments where no socket exists.
    try {
      const info = getConnInfo(c);
      if (info?.remote?.address) {
        return info.remote.address;
      }
    } catch {
      // Safely ignore errors in test environment
    }

    // 3. Fallback for test environment where no network connection exists
    return "test-client";
  };

  const limiter = rateLimiter({
    windowMs: config.rateLimitWindowSeconds * 1000,
    limit: config.rateLimitMaxRequests,
    keyGenerator: keyGenerator,
    handler: (c: Context, _next: Next) => {
      const ip = keyGenerator(c);
      log.warn({ ip, path: c.req.path }, "Rate limit exceeded for IP address");

      return c.text(
        ReasonPhrases.TOO_MANY_REQUESTS,
        StatusCodes.TOO_MANY_REQUESTS,
      );
    },
  });

  app.use(limiter);
}
