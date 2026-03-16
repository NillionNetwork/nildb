// LIMITATION: This worker uses setInterval and assumes a single application instance per database.
// Running multiple instances against the same database will cause duplicate billing.
// Horizontal scaling would require distributed locking (e.g. MongoDB advisory locks).

import * as BuildersRepository from "@nildb/builders/builders.repository";
import type { BuilderDocument } from "@nildb/builders/builders.types";
import { computeStatus } from "@nildb/credits/credits.services";
import { FeatureFlag, hasFeatureFlag, type AppBindings } from "@nildb/env";
import { Effect as E, pipe } from "effect";

import { calculateBillableStorage, calculateBuilderStorage, calculateStorageCost } from "./storage.services";

const BILLING_INTERVAL_MS = 60 * 60 * 1000; // 1 hour

/**
 * Run a single billing cycle.
 * Fetches all credit-enabled builders, computes storage for each,
 * and bills those exceeding the free tier.
 */
export async function runBillingCycle(bindings: AppBindings): Promise<void> {
  const { log, config } = bindings;

  if (!hasFeatureFlag(config.enabledFeatures, FeatureFlag.CREDITS)) {
    return;
  }

  const startMs = Date.now();
  log.info("Starting billing cycle");

  try {
    const builders = await pipe(BuildersRepository.findAllCreditBuilders(bindings), E.runPromise);

    let freeTier = 0;
    let billed = 0;
    let errors = 0;
    let totalStorageBytes = 0;
    let totalBilledUsd = 0;

    for (const builder of builders) {
      try {
        const result = await billBuilder(bindings, builder);
        totalStorageBytes += result.storageBytes;
        if (result.cost > 0) {
          billed++;
          totalBilledUsd += result.cost;
        } else {
          freeTier++;
        }
      } catch (error) {
        errors++;
        log.error({ error, builderId: builder.did }, "Failed to bill builder");
      }
    }

    log.info(
      {
        builders: builders.length,
        freeTier,
        billed,
        errors,
        totalStorageBytes,
        totalBilledUsd: Math.round(totalBilledUsd * 1_000_000) / 1_000_000,
        durationMs: Date.now() - startMs,
      },
      "Billing cycle complete",
    );
  } catch (error) {
    log.error({ error }, "Billing cycle failed");
  }
}

/**
 * Bill a single builder. Returns storage and cost metrics for aggregation.
 */
async function billBuilder(
  bindings: AppBindings,
  builder: BuilderDocument,
): Promise<{ storageBytes: number; cost: number }> {
  const { log, config } = bindings;
  const builderId = builder.did;

  const storageBytes = await calculateBuilderStorage(bindings, builder);
  const billableBytes = calculateBillableStorage(storageBytes, config.freeTierBytes);

  const now = new Date();

  // Always update storage snapshot and lastBillingCycle
  await pipe(BuildersRepository.updateStorageSnapshot(bindings, builderId, storageBytes, now), E.runPromise);

  if (billableBytes <= 0) {
    return { storageBytes, cost: 0 };
  }

  const lastBilling = builder.lastBillingCycle ?? builder._created;
  const hoursSinceLastBilling = (now.getTime() - lastBilling.getTime()) / (1000 * 60 * 60);

  const cost = calculateStorageCost(billableBytes, config.storageCostPerGbHour, hoursSinceLastBilling);

  log.debug({ builderId, storageBytes, billableBytes, hoursSinceLastBilling, cost }, "Billing builder");

  if (cost <= 0) {
    return { storageBytes, cost: 0 };
  }

  const { newBalance, depleted } = await pipe(
    BuildersRepository.deductCreditsUsd(bindings, builderId, cost),
    E.runPromise,
  );

  log.debug({ builderId, newBalance, depleted }, "Builder balance updated");

  // Compute status from known data — no need to re-fetch the builder
  const newStatus = computeStatus({ ...builder, storageBytes, creditsUsd: newBalance }, config);

  if (newStatus !== builder.status) {
    const creditsDepleted = depleted && !builder.creditsDepleted ? new Date() : builder.creditsDepleted;
    await pipe(BuildersRepository.updateStatus(bindings, builderId, newStatus, creditsDepleted), E.runPromise);
    log.info({ builderId, from: builder.status, to: newStatus }, "Builder status changed");
  }

  return { storageBytes, cost };
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
