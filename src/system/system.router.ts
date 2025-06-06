import type { ControllerOptions } from "#/common/types";
import * as SystemController from "./system.controllers";

export const SystemEndpoint = {
  Health: "/health",
  About: "/about",
} as const;

/**
 * Registers all system-related routes with the application.
 *
 * Mounts the following endpoints:
 * - GET    /health - Simple check to see if the Api is responding
 * - GET    /about - Get node metadata
 * - POST   /api/v1/system/maintenance/start - Start maintenance mode
 * - POST   /api/v1/system/maintenance/stop - Stop maintenance mode
 * - POST   /api/v1/system/log-level - Set the application log level
 * - GET    /api/v1/system/log-level - Get the current log level
 *
 * All endpoints require root privileges.
 *
 * @param options - Controller configuration including app instance and bindings
 */
export function buildSystemRouter(options: ControllerOptions): void {
  SystemController.aboutNode(options);
  SystemController.startMaintenance(options);
  SystemController.stopMaintenance(options);
  SystemController.getLogLevel(options);
  SystemController.healthCheck(options);
  SystemController.setLogLevel(options);
}
