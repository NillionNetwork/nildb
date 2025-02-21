import { StatusCodes, getReasonPhrase } from "http-status-codes";
import type { App } from "#/app";
import { PathsV1 } from "#/common/paths";
import type { AppBindings } from "#/env";
import { isRoleAllowed } from "#/middleware/auth.middleware";
import * as SchemasController from "#/schemas/schemas.controllers";

export function buildSchemasRouter(app: App, _bindings: AppBindings): void {
  // biome-ignore lint/suspicious/noConfusingVoidType: <explanation>
  app.use(PathsV1.schemas.root, async (c, next): Promise<void | Response> => {
    return isRoleAllowed(c, ["organization"])
      ? next()
      : c.text(
          getReasonPhrase(StatusCodes.UNAUTHORIZED),
          StatusCodes.UNAUTHORIZED,
        );
  });

  SchemasController.list(app);
  SchemasController.add(app);
  SchemasController.remove(app);
  SchemasController.metadata(app);

  SchemasController.createIndex(app);
  SchemasController.dropIndex(app);
}
