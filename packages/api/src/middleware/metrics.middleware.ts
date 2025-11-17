import type { ControllerOptions } from "@nildb/common/types";
import type { Histogram } from "@opentelemetry/api";
import { metrics } from "@opentelemetry/api";
import type { MiddlewareHandler } from "hono";
import { routePath } from "hono/route";
import packageJson from "../../package.json";

// HTTP semantic convention attributes
const ATTR_HTTP_REQUEST_METHOD = "http.request.method";
const ATTR_HTTP_RESPONSE_STATUS_CODE = "http.response.status_code";
const ATTR_HTTP_ROUTE = "http.route";
const ATTR_URL_SCHEME = "url.scheme";

// Metric instruments
let httpServerDuration: Histogram | null = null;

/**
 * HTTP metrics middleware for Hono
 *
 * Records HTTP request metrics with route-level granularity:
 * - http.server.duration (histogram) - request duration in milliseconds
 *
 * Attributes:
 * - http.route: The matched route pattern (e.g., "/v1/collections/:id")
 * - http.request.method: HTTP method
 * - http.response.status_code: Response status code
 * - url.scheme: URL scheme (http/https)
 */
export function metricsMiddleware(options: ControllerOptions): void {
  const { app } = options;

  // Initialize metrics instruments on first use
  if (!httpServerDuration) {
    const meter = metrics.getMeter("@nillion/nildb", packageJson.version);

    httpServerDuration = meter.createHistogram("http.server.duration", {
      description: "Duration of HTTP server requests",
      unit: "ms",
      advice: {
        explicitBucketBoundaries: [
          5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000,
        ],
      },
    });
  }

  const middleware: MiddlewareHandler = async (c, next) => {
    const start = performance.now();

    try {
      await next();
    } finally {
      const duration = performance.now() - start;
      const route = routePath(c); // Get matched route pattern
      const method = c.req.method;
      const statusCode = c.res.status;
      const scheme = new URL(c.req.url).protocol.replace(":", "");

      // Record metrics with semantic convention attributes
      httpServerDuration?.record(duration, {
        [ATTR_HTTP_ROUTE]: route,
        [ATTR_HTTP_REQUEST_METHOD]: method,
        [ATTR_HTTP_RESPONSE_STATUS_CODE]: statusCode,
        [ATTR_URL_SCHEME]: scheme,
      });
    }
  };

  app.use(middleware);
}
