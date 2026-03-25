import type { ControllerOptions } from "@nildb/common/types";

import * as CreditsController from "./credits.controllers";
import * as RevocationsController from "./revocations.controllers";

/**
 * Build the credits router.
 * Routes are only registered if the credits feature is enabled.
 */
export function buildCreditsRouter(options: ControllerOptions): void {
  CreditsController.registerCredits(options);
  CreditsController.readCredits(options);
  CreditsController.readPayments(options);
  CreditsController.readPricing(options);
  RevocationsController.revokeToken(options);
  RevocationsController.lookupRevocations(options);
  CreditsController.adminCreditTopUp(options);
  CreditsController.adminUpdatePricing(options);
  CreditsController.adminListBuilders(options);
}
