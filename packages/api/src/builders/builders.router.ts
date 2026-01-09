import type { ControllerOptions } from "@nildb/common/types";

import * as BuilderController from "./builders.controllers.js";

/**
 * Registers the builders domain.
 *
 * - POST   /v1/builders/register - Register a new builder
 * - GET    /v1/builders/me       - Read the builder's profile
 * - POST   /v1/builders/me       - Updates the builder's profile
 * - DELETE /v1/builders/me       - Deletes the builder
 *
 */
export function buildBuildersRouter(options: ControllerOptions): void {
  BuilderController.register(options);
  BuilderController.readProfile(options);
  BuilderController.updateProfile(options);
  BuilderController.deleteBuilder(options);
}
