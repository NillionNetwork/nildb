import type { Hono } from "hono";
import type { ControllerOptions } from "#/common/types";
import * as SystemController from "./system.controllers";

/**
 * Registers the system domain.
 *
 * Mounts the following endpoints:
 *
 * - GET    /health                      - Health check endpoint
 * - GET    /about                       - Node information and status
 * - GET    /metrics                     - Prometheus metrics (if enabled)
 * - GET    /openapi.json                - OpenAPI specification (if enabled)
 * - POST   /v1/system/maintenance/start - Start maintenance mode (admin only)
 * - POST   /v1/system/maintenance/stop  - Stop maintenance mode (admin only)
 * - GET    /v1/system/log-level         - Get current log level (admin only)
 * - POST   /v1/system/log-level         - Set log level (admin only)
 */
export function buildSystemRouter(options: ControllerOptions): {
  metrics: Hono | undefined;
} {
  SystemController.readAboutNode(options);
  SystemController.readNodeHealth(options);
  SystemController.getOpenApiJson(options);
  const metricsResult = SystemController.getMetrics(options);

  SystemController.startMaintenance(options);
  SystemController.stopMaintenance(options);
  SystemController.readLogLevel(options);
  SystemController.setLogLevel(options);

  return metricsResult;
}
