import type { ControllerOptions } from "#/common/types";
import * as AccountController from "./accounts.controllers";

export function buildAccountsRouter(options: ControllerOptions): void {
  AccountController.get(options);
  AccountController.register(options);
  AccountController.remove(options);
  AccountController.setPublicKey(options);
  AccountController.getSubscription(options);
}
