import { prometheus } from "@hono/prometheus";
import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { timeout } from "hono/timeout";
import { Temporal } from "temporal-polyfill";
import { buildAccountsRouter } from "#/accounts/accounts.router";
import { buildAdminRouter } from "#/admin/admin.router";
import { buildDataRouter } from "#/data/data.router";
import { corsMiddleware } from "#/middleware/cors.middleware";
import { useLoggerMiddleware } from "#/middleware/logger.middleware";
import { useSubscriptionCheckMiddleware } from "#/middleware/subscription.middleware";
import { buildQueriesRouter } from "#/queries/queries.router";
import { buildSchemasRouter } from "#/schemas/schemas.router";
import { createOpenApiRouter } from "./docs/docs.router";
import type { AppBindings, AppEnv } from "./env";
import { useAuthMiddleware } from "./middleware/auth.middleware";
import { useMaintenanceMiddleware } from "./middleware/maintenance.middleware";
import { buildSystemRouter } from "./system/system.router";

export type App = Hono<AppEnv>;

export function buildApp(bindings: AppBindings): { app: App; metrics: Hono } {
  const app = new Hono<AppEnv>();
  const metricsApp = new Hono();

  app.use(corsMiddleware(bindings));

  // 16mb corresponds to the max mongodb document size. However, this is a crude check
  // because in practice body could/will have multiple documents.
  app.use("*", bodyLimit({ maxSize: 16 * 1024 * 1024 }));

  app.use((c, next) => {
    c.env = bindings;
    return next();
  });

  buildSystemRouter(app, bindings);
  createOpenApiRouter(app, bindings);

  app.use(useLoggerMiddleware(bindings.log));
  app.use(useMaintenanceMiddleware(bindings));
  app.use(useAuthMiddleware(bindings));
  app.use(useSubscriptionCheckMiddleware(bindings));

  const { printMetrics, registerMetrics } = prometheus();
  app.use("*", registerMetrics);
  metricsApp.get("/metrics", printMetrics);

  const limit = Temporal.Duration.from({ minutes: 5 }).total("milliseconds");
  app.use("*", timeout(limit));
  buildAdminRouter(app, bindings);
  buildAccountsRouter(app, bindings);
  buildSchemasRouter(app, bindings);

  buildQueriesRouter(app, bindings);
  buildDataRouter(app, bindings);

  return { app, metrics: metricsApp };
}
