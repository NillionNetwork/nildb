import { Hono } from "hono";
import { buildBuildersRouter } from "./builders/builders.router.js";
import { buildCollectionsRouter } from "./collections/collections.router.js";
import type { ControllerOptions } from "./common/types.js";
import { buildDataRouter } from "./data/data.router.js";
import type { AppBindings, AppEnv } from "./env.js";
import { injectBindingsMiddleware } from "./middleware/bindings.middleware.js";
import { corsMiddleware } from "./middleware/cors.middleware.js";
import { limitRequestBodySizeMiddleware } from "./middleware/limit-body.middleware.js";
import { loggerMiddleware } from "./middleware/logger.middleware.js";
import { maintenanceMiddleware } from "./middleware/maintenance.middleware.js";
import { rateLimitMiddleware } from "./middleware/rate-limit.middleware.js";
import { buildQueriesRouter } from "./queries/queries.router.js";
import { buildSystemRouter } from "./system/system.router.js";
import { buildUserRouter } from "./users/users.router.js";

export type App = Hono<AppEnv>;

export async function buildApp(bindings: AppBindings): Promise<{ app: App }> {
  const app = new Hono<AppEnv>();
  const options: ControllerOptions = { app, bindings };

  // Setup middlewares
  injectBindingsMiddleware(options);
  // Readiness check middleware - block traffic until migrations complete
  app.use("*", async (c, next) => {
    if (!c.env.migrationsComplete && c.req.path !== "/health") {
      return c.json(
        { error: "Service not ready, migrations in progress" },
        503,
      );
    }
    return next();
  });

  corsMiddleware(options);
  rateLimitMiddleware(options);
  limitRequestBodySizeMiddleware(options);
  loggerMiddleware(options);
  maintenanceMiddleware(options);

  // Setup controllers
  buildSystemRouter(options);
  buildBuildersRouter(options);
  buildCollectionsRouter(options);
  buildQueriesRouter(options);
  buildDataRouter(options);
  buildUserRouter(options);

  return { app };
}
