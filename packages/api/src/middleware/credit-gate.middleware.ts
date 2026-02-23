import type { BuilderDocument, BuilderStatus } from "@nildb/builders/builders.types";
import { computeStatus } from "@nildb/credits/credits.services";
import { FeatureFlag, hasFeatureFlag, type AppEnv } from "@nildb/env";
import type { MiddlewareHandler } from "hono/types";
import { getReasonPhrase, StatusCodes } from "http-status-codes";

/**
 * Operation types for credit-based access control.
 */
export type OperationType = "read" | "write" | "execute";

/**
 * Permissions granted to each status level.
 */
const STATUS_PERMISSIONS: Record<BuilderStatus, OperationType[]> = {
  free_tier: ["read", "write", "execute"],
  active: ["read", "write", "execute"],
  warning: ["read", "write", "execute"],
  read_only: ["read"],
  suspended: [],
  pending_purge: [],
};

/**
 * Check if a status allows a given operation.
 */
function statusAllowsOperation(status: BuilderStatus, operation: OperationType): boolean {
  return STATUS_PERMISSIONS[status].includes(operation);
}

/**
 * Middleware to gate operations based on credit status.
 * Only enforced when CREDITS feature flag is enabled.
 *
 * @param operation - The type of operation being performed
 */
export function requireCredits(operation: OperationType): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    const { config, log } = c.env;

    // Skip gating if credits feature is not enabled
    if (!hasFeatureFlag(config.enabledFeatures, FeatureFlag.CREDITS)) {
      return next();
    }

    const builder: BuilderDocument = c.get("builder");

    // If builder doesn't have credits enabled yet, skip gating
    if (builder.creditsUsd === undefined) {
      return next();
    }

    // Compute current status
    const status = computeStatus(builder, config);

    // Check if operation is allowed
    if (!statusAllowsOperation(status, operation)) {
      log.debug("Operation %s denied for builder %s with status %s", operation, builder.did, status);

      // Return appropriate status code based on builder status
      if (status === "suspended" || status === "pending_purge") {
        return c.json(
          {
            ts: new Date().toISOString(),
            errors: ["Account suspended due to insufficient credits"],
          },
          StatusCodes.PAYMENT_REQUIRED,
        );
      }

      if (status === "read_only") {
        return c.json(
          {
            ts: new Date().toISOString(),
            errors: ["Write operations disabled - please add credits to your account"],
          },
          StatusCodes.PAYMENT_REQUIRED,
        );
      }

      return c.text(getReasonPhrase(StatusCodes.PAYMENT_REQUIRED), StatusCodes.PAYMENT_REQUIRED);
    }

    // Add warning header if status is warning
    if (status === "warning") {
      c.header("X-Credits-Warning", "Your credit balance is low. Please add credits to avoid service interruption.");
    }

    return next();
  };
}
