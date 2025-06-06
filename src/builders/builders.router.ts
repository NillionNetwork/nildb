import type { ControllerOptions } from "#/common/types";
import * as BuilderController from "./builders.controllers";

/**
 * Registers all builder-related routes with the application.
 *
 * Mounts the following endpoints:
 * - POST /api/v1/register - Register a new organisation builder
 * - GET /api/v1/builders/me - Retrieve authenticated user's profile
 * - DELETE /api/v1/builders/me - Delete authenticated user's builder
 * - PUT /api/v1/builders/me - Update authenticated user's profile
 *
 * @param options - Controller configuration including app instance and bindings
 */
export function buildBuildersRouter(options: ControllerOptions): void {
  BuilderController.register(options);
  BuilderController.getProfile(options);
  BuilderController._delete(options);
  BuilderController.updateProfile(options);
}
