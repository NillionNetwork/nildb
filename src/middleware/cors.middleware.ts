import type { MiddlewareHandler } from "hono";
import { cors } from "hono/cors";
import type { AppBindings } from "#/env";

const ALLOW_NODES = ["https://nildb-demo.nillion.network"];

const ALLOW_ORIGINS = [
  "https://docs.nillion.com",
  "https://nillion-docs-git-feat-open-api-integration-nillion.vercel.app",
];

export function corsMiddleware(bindings: AppBindings): MiddlewareHandler {
  if (ALLOW_NODES.includes(bindings.node.endpoint.toLowerCase())) {
    return cors({
      origin: ALLOW_ORIGINS,
      allowHeaders: ["Content-Type", "Authorization"],
      allowMethods: ["GET", "PUT", "POST", "DELETE"],
      maxAge: 3600,
      credentials: true,
    });
  }

  return (_c, next) => next();
}
