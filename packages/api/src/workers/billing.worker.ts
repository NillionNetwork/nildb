import * as BuildersRepository from "@nildb/builders/builders.repository";
import { computeStatus } from "@nildb/credits/credits.services";
import { FeatureFlag, hasFeatureFlag, type AppBindings } from "@nildb/env";
import { Effect as E, pipe } from "effect";

import { calculateBillableStorage, calculateBuilderStorage, calculateStorageCost } from "./storage.services";

const BILLING_INTERVAL_MS = 60 * 60 * 1000; // 1 hour
const BUILDERS_PER_BATCH = 100;

/**
 * Run a single billing cycle.
 * Finds builders that haven't been billed in the last hour and bills them.
 */
export async function runBillingCycle(bindings: AppBindings): Promise<void> {
  const { log, config } = bindings;

  // Only run if credits feature is enabled
  if (!hasFeatureFlag(config.enabledFeatures, FeatureFlag.CREDITS)) {
    return;
  }

  log.info("Starting billing cycle");

  try {
    const oneHourAgo = new Date(Date.now() - BILLING_INTERVAL_MS);

    const builders = await pipe(
      BuildersRepository.findBuildersForBilling(bindings, oneHourAgo, BUILDERS_PER_BATCH),
      E.runPromise,
    );

    log.info("Found %d builders to bill", builders.length);

    for (const builder of builders) {
      try {
        await billBuilder(bindings, builder.did);
      } catch (error) {
        log.error({ error, builderId: builder.did }, "Failed to bill builder");
      }
    }

    log.info("Billing cycle complete");
  } catch (error) {
    log.error({ error }, "Billing cycle failed");
  }
}

/**
 * Bill a single builder.
 */
async function billBuilder(bindings: AppBindings, builderId: string): Promise<void> {
  const { log, config } = bindings;

  // Get fresh builder data
  const builder = await pipe(BuildersRepository.findOne(bindings, builderId), E.runPromise);

  // Calculate current storage
  const storageBytes = await calculateBuilderStorage(bindings, builder);

  // Calculate billable storage
  const billableBytes = calculateBillableStorage(storageBytes, config.freeTierBytes);

  const now = new Date();

  // Calculate hours since last billing
  const lastBilling = builder.lastBillingCycle ?? builder._created;
  const hoursSinceLastBilling = (now.getTime() - lastBilling.getTime()) / (1000 * 60 * 60);

  // Calculate cost
  const cost = calculateStorageCost(billableBytes, config.storageCostPerGbHour, hoursSinceLastBilling);

  log.debug({ builderId, storageBytes, billableBytes, hoursSinceLastBilling, cost }, "Billing builder");

  // Update storage snapshot
  await pipe(BuildersRepository.updateStorageSnapshot(bindings, builderId, storageBytes, now), E.runPromise);

  // Deduct credits if there's a cost
  if (cost > 0) {
    const { newBalance, depleted } = await pipe(
      BuildersRepository.deductCreditsUsd(bindings, builderId, cost),
      E.runPromise,
    );

    log.debug({ builderId, newBalance, depleted }, "Builder balance updated");

    // Update status based on new balance
    const updatedBuilder = await pipe(BuildersRepository.findOne(bindings, builderId), E.runPromise);

    const newStatus = computeStatus(updatedBuilder, config);

    // Update status if it changed
    if (newStatus !== builder.status) {
      const creditsDepleted = depleted && !builder.creditsDepleted ? new Date() : builder.creditsDepleted;
      await pipe(BuildersRepository.updateStatus(bindings, builderId, newStatus, creditsDepleted), E.runPromise);
      log.info("Builder %s status changed from %s to %s", builderId, builder.status, newStatus);
    }
  }
}

/**
 * Start the billing worker.
 * Runs billing cycles on a regular interval.
 */
export function startBillingWorker(bindings: AppBindings): NodeJS.Timeout | null {
  const { config, log } = bindings;

  if (!hasFeatureFlag(config.enabledFeatures, FeatureFlag.CREDITS)) {
    log.info("Credits feature not enabled, skipping billing worker");
    return null;
  }

  log.info("Starting billing worker (interval: %d ms)", BILLING_INTERVAL_MS);

  // Run immediately on startup
  void runBillingCycle(bindings);

  // Then run on interval
  return setInterval(() => {
    void runBillingCycle(bindings);
  }, BILLING_INTERVAL_MS);
}
