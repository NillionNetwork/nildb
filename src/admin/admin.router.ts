import type { ControllerOptions } from "#/common/types";
import * as AdminAccountsControllers from "./admin.controllers.accounts";
import * as AdminDataControllers from "./admin.controllers.data";
import * as AdminQueriesControllers from "./admin.controllers.queries";
import * as AdminSchemasControllers from "./admin.controllers.schemas";
import * as AdminSystemControllers from "./admin.controllers.system";

export function buildAdminRouter(options: ControllerOptions): void {
  AdminAccountsControllers.create(options);
  AdminAccountsControllers.remove(options);
  AdminAccountsControllers.list(options);
  AdminAccountsControllers.setSubscriptionState(options);
  AdminAccountsControllers.getSubscriptionState(options);

  AdminDataControllers.remove(options);
  AdminDataControllers.flush(options);
  AdminDataControllers.read(options);
  AdminDataControllers.tail(options);
  AdminDataControllers.update(options);
  AdminDataControllers.upload(options);

  AdminQueriesControllers.add(options);
  AdminQueriesControllers.remove(options);
  AdminQueriesControllers.execute(options);
  AdminQueriesControllers.getQueryJob(options);

  AdminSchemasControllers.add(options);
  AdminSchemasControllers.remove(options);
  AdminSchemasControllers.metadata(options);
  AdminSchemasControllers.createIndex(options);
  AdminSchemasControllers.dropIndex(options);

  AdminSystemControllers.setMaintenanceWindow(options);
  AdminSystemControllers.deleteMaintenanceWindow(options);
  AdminSystemControllers.setLogLevel(options);
  AdminSystemControllers.getLogLevel(options);
}
