import type { ControllerOptions } from "#/common/types";
import * as AdminControllers from "./admin.controllers";

export function buildAdminRouter(options: ControllerOptions): void {
  AdminControllers.setMaintenanceWindow(options);
  AdminControllers.deleteMaintenanceWindow(options);
  AdminControllers.setLogLevel(options);
  AdminControllers.getLogLevel(options);
}
