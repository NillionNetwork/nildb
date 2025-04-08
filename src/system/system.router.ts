import * as SystemController from "./system.controllers";
import type { ControllerOptions } from "#/common/types";

export const SystemEndpoint = {
  About: "/about",
  Health: "/health",
  Metrics: "/metrics",
} as const;

export function buildSystemRouter(options: ControllerOptions): void {
  SystemController.aboutNode(options);
  SystemController.healthCheck(options);
}
