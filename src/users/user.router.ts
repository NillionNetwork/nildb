import type { ControllerOptions } from "#/common/types";
import * as UserController from "./user.controllers";

export function buildUserRouter(options: ControllerOptions): void {
  UserController.list(options);

  UserController.readPermissions(options);
  UserController.addPermissions(options);
  UserController.updatePermissions(options);
  UserController.deletePermissions(options);
}
