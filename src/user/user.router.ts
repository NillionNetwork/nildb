import type { ControllerOptions } from "#/common/types";
import * as UserController from "#/user/user.controllers";

export function buildUserRouter(options: ControllerOptions): void {
  UserController.list(options);
}
