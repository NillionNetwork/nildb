import type { ControllerOptions } from "@nildb/common/types";
import * as UserController from "./users.controllers.js";

/**
 * Registers the users domain.
 *
 * Mounts the following endpoints:
 * GET      /v1/users/me                           Retrieve the authenticated user's profile
 * GET      /v1/users/data                         Retrieve a list of references to the user's owned data documents
 * POST     /v1/users/data                         Update a user-owned data
 * GET      /v1/users/data/:schema/:document       Retrieve user-owned data by schema and document id
 * DELETE   /v1/users/data/:schema/:document       Delete a user-owned data document
 * POST     /v1/users/data/acl/grant               Grant access to user-owned data
 * POST     /v1/users/data/acl/revoke              Remove access to user-owned data
 *
 */
export function buildUserRouter(options: ControllerOptions): void {
  UserController.readProfile(options);
  UserController.listDataReferences(options);
  UserController.readData(options);
  UserController.updateData(options);
  UserController.deleteData(options);
  UserController.grantAccess(options);
  UserController.revokeAccess(options);
}
