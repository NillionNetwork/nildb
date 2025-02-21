import { StatusCodes, getReasonPhrase } from "http-status-codes";
import type { App } from "#/app";
import { PathsV1 } from "#/common/paths";
import type { AppBindings } from "#/env";
import { isRoleAllowed } from "#/middleware/auth.middleware";
import * as AdminAccountsControllers from "./admin.controllers.accounts";
import * as AdminDataControllers from "./admin.controllers.data";
import * as AdminQueriesControllers from "./admin.controllers.queries";
import * as AdminSchemasControllers from "./admin.controllers.schemas";
import * as AdminSystemControllers from "./admin.controllers.system";

export function buildAdminRouter(app: App, _bindings: AppBindings): void {
  app.use(
    `${PathsV1.admin.root}/*`,
    // biome-ignore lint/suspicious/noConfusingVoidType: <explanation>
    async (c, next): Promise<void | Response> => {
      return isRoleAllowed(c, ["admin", "root"])
        ? next()
        : c.text(
            getReasonPhrase(StatusCodes.UNAUTHORIZED),
            StatusCodes.UNAUTHORIZED,
          );
    },
  );

  AdminAccountsControllers.create(app);
  AdminAccountsControllers.remove(app);
  AdminAccountsControllers.list(app);
  AdminAccountsControllers.setSubscriptionState(app);

  AdminDataControllers.remove(app);
  AdminDataControllers.flush(app);
  AdminDataControllers.read(app);
  AdminDataControllers.tail(app);
  AdminDataControllers.update(app);
  AdminDataControllers.upload(app);

  AdminQueriesControllers.add(app);
  AdminQueriesControllers.remove(app);
  AdminQueriesControllers.execute(app);

  AdminSchemasControllers.add(app);
  AdminSchemasControllers.remove(app);
  AdminSchemasControllers.metadata(app);
  AdminSchemasControllers.createIndex(app);
  AdminSchemasControllers.dropIndex(app);

  AdminSystemControllers.setMaintenanceWindow(app);
  AdminSystemControllers.deleteMaintenanceWindow(app);
}
