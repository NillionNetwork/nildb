import type { MiddlewareHandler } from "hono";
import type { AppBindings } from "#/env";
import { cors } from "hono/cors";
import { StatusCodes } from "http-status-codes";

const ENABLE_CORS_FOR = [
  "https://nildb-demo.nillion.network",
  "https://nildb-rugk.nillion.network",
  "https://nildb-p3mx.nillion.network",
  "https://nildb-nx8v.nillion.network",
  "http://localhost:8081", // Note: allows non-HTTPS for local development
];

const ALLOW_ORIGINS = ["nillion.com", "nillion.pub", "fiftytwo.gg"];

export function corsMiddleware(bindings: AppBindings): MiddlewareHandler {
  // only enable cors on specific nodes
  if (!ENABLE_CORS_FOR.includes(bindings.node.endpoint.toLowerCase())) {
    return (_c, next) => next();
  }

  return async (c, next) => {
    const origin = c.req.header("Origin");
    if (!origin) return next();

    // Check if origin is allowed
    let isAllowed = false;

    // Special case for development
    if (origin === "http://localhost:8081") {
      isAllowed = true;
    }

    if (origin.startsWith("https://")) {
      const hostname = origin.replace("https://", "");

      for (const allowed of ALLOW_ORIGINS) {
        if (hostname === allowed || hostname.endsWith(`.${allowed}`)) {
          isAllowed = true;
          break;
        }
      }
    }

    // Handle preflight OPTIONS requests
    if (c.req.method === "OPTIONS") {
      if (isAllowed) {
        // Apply CORS middleware for allowed origins
        return cors({
          origin: origin,
          allowHeaders: ["Content-Type", "Authorization"],
          allowMethods: ["GET", "POST", "DELETE"],
          maxAge: 3600,
          credentials: true,
        })(c, next);
      }

      // For disallowed origins, return 204 without CORS headers
      c.status(StatusCodes.NO_CONTENT);
      return c.body(null);
    }

    // Handle actual requests (GET, POST, etc.)
    if (isAllowed) {
      // Apply CORS middleware and mirror origin
      return cors({
        origin: origin,
        allowHeaders: ["Content-Type", "Authorization"],
        allowMethods: ["GET", "POST", "DELETE"],
        maxAge: 3600,
        credentials: true,
      })(c, next);
    }

    // For disallowed origins, proceed without CORS headers
    return next();
  };
}
