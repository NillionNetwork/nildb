import type { MiddlewareHandler } from "hono";
import { cors } from "hono/cors";
import type { AppBindings } from "#/env";

export function corsMiddleware(_bindings: AppBindings): MiddlewareHandler {
  return cors({
    // This will enable cors with credentials for any URL which is desired. The 2nd layer for security are NUCs (auth
    // tokens) which are processed after CORS.
    origin: (origin) => origin,
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: ["GET", "POST", "DELETE"],
    maxAge: 3600,
    credentials: true,
  });
}
