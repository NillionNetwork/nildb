import { Hono } from "hono";
import { buildBuildersRouter } from "./builders/builders.router";
import { buildCollectionsRouter } from "./collections/collections.router";
import type { ControllerOptions } from "./common/types";
import { buildDataRouter } from "./data/data.router";
import type { AppBindings, AppEnv } from "./env";
import { injectBindingsMiddleware } from "./middleware/bindings.middleware";
import { corsMiddleware } from "./middleware/cors.middleware";
import { limitRequestBodySizeMiddleware } from "./middleware/limit-body.middleware";
import { loggerMiddleware } from "./middleware/logger.middleware";
import { maintenanceMiddleware } from "./middleware/maintenance.middleware";
import { buildQueriesRouter } from "./queries/queries.router";
import { buildSystemRouter } from "./system/system.router";
import { buildUserRouter } from "./users/users.router";

export type App = Hono<AppEnv>;

export async function buildApp(
  bindings: AppBindings,
): Promise<{ app: App; metrics: Hono | undefined }> {
  const app = new Hono<AppEnv>();
  const options: ControllerOptions = { app, bindings };

  // Setup middlewares
  corsMiddleware(options);
  limitRequestBodySizeMiddleware(options);
  injectBindingsMiddleware(options);
  loggerMiddleware(options);
  maintenanceMiddleware(options);

  // Setup controllers
  const { metrics } = buildSystemRouter(options);
  buildBuildersRouter(options);
  buildCollectionsRouter(options);
  buildQueriesRouter(options);
  buildDataRouter(options);
  buildUserRouter(options);

  return { app, metrics };
}
