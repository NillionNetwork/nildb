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
  const trustedProxyCount = config.trustedProxyCount;

  if (!config.rateLimitEnabled) {
    log.info("Rate limiting is disabled.");
    return;
  }

  log.info(
    {
      window: `${config.rateLimitWindowSeconds}s`,
      limit: config.rateLimitMaxRequests,
      trustedProxyCount,
    },
    "Request rate limiting enabled",
  );

  const socketAddress = (c: Context): string | null => {
    // `getConnInfo` throws in test environments where no socket exists.
    try {
      return getConnInfo(c)?.remote?.address ?? null;
    } catch {
      return null;
    }
  };

  const keyGenerator = (c: Context): string => {
    // x-forwarded-for is set by the client unless a proxy overwrites it, so
    // taking the first entry let anyone rotate their rate-limit key at will
    // and never be limited. Only entries appended by a trusted proxy can be
    // believed: with N proxies in front, the Nth entry from the right is the
    // address the outermost trusted proxy saw.
    if (trustedProxyCount > 0) {
      const forwarded = c.req.header("x-forwarded-for");
      if (forwarded) {
        const entries = forwarded
          .split(",")
          .map((entry) => entry.trim())
          .filter(Boolean);
        const index = entries.length - trustedProxyCount;
        if (index >= 0 && index < entries.length) {
          return entries[index];
        }
        // Fewer entries than expected: the request did not traverse the
        // proxies we trust, so fall through to the socket address.
      }
    }

    const address = socketAddress(c);
    if (address) {
      return address;
    }

    // Fallback for test environment where no network connection exists
    return "test-client";
  };

  const limiter = rateLimiter({
    windowMs: config.rateLimitWindowSeconds * 1000,
    limit: config.rateLimitMaxRequests,
    keyGenerator: keyGenerator,
    handler: (c: Context, _next: Next) => {
      const ip = keyGenerator(c);
      log.warn({ ip, path: c.req.path }, "Rate limit exceeded for IP address");

      return c.text(ReasonPhrases.TOO_MANY_REQUESTS, StatusCodes.TOO_MANY_REQUESTS);
    },
  });

  app.use(limiter);
}
