import type { ControllerOptions } from "#/common/types";
import * as AccountController from "./accounts.controllers";

/**
 * Registers all account-related routes with the application.
 *
 * Mounts the following endpoints:
 * - POST /api/v1/register - Register a new organisation account
 * - GET /api/v1/accounts/me - Retrieve authenticated user's profile
 * - DELETE /api/v1/accounts/me - Delete authenticated user's account
 * - PUT /api/v1/accounts/me - Update authenticated user's profile
 *
 * @param options - Controller configuration including app instance and bindings
 */
export function buildAccountsRouter(options: ControllerOptions): void {
  AccountController.register(options);
  AccountController.getProfile(options);
  AccountController._delete(options);
  AccountController.updateProfile(options);
}
