// LIMITATION: This worker uses setInterval and assumes a single application instance per database.
// Running multiple instances against the same database will cause duplicate purge operations.
// Horizontal scaling would require distributed locking (e.g. MongoDB advisory locks).

import * as BuildersRepository from "@nildb/builders/builders.repository";
import * as CollectionsService from "@nildb/collections/collections.services";
import { FeatureFlag, hasFeatureFlag, type AppBindings } from "@nildb/env";
import * as QueriesService from "@nildb/queries/queries.services";
import { Effect as E, pipe } from "effect";

const PURGE_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours
const BUILDERS_PER_BATCH = 10; // Limit batch size for safety
const PURGE_LEASE_MS = 60 * 60 * 1000;

/**
 * Run a single purge cycle.
 * Finds builders that have been pending_purge for longer than the grace period.
 */
export async function runPurgeCycle(bindings: AppBindings): Promise<void> {
  const { log, config } = bindings;

  // Only run if credits feature is enabled
  if (!hasFeatureFlag(config.enabledFeatures, FeatureFlag.CREDITS)) {
    return;
  }

  log.info("Starting purge cycle");

  try {
    const gracePeriodMs = config.gracePeriodDays * 24 * 60 * 60 * 1000;
    const cutoffDate = new Date(Date.now() - gracePeriodMs);
    const staleClaimBefore = new Date(Date.now() - PURGE_LEASE_MS);

    const builders = await pipe(
      BuildersRepository.findBuildersPendingPurge(bindings, cutoffDate, staleClaimBefore, BUILDERS_PER_BATCH),
      E.runPromise,
    );

    log.info("Found %d builders pending purge", builders.length);

    for (const builder of builders) {
      try {
        await purgeBuilder(bindings, builder.did);
      } catch (error) {
        log.error({ error, builderId: builder.did }, "Failed to purge builder");
      }
    }

    log.info("Purge cycle complete");
  } catch (error) {
    log.error({ error }, "Purge cycle failed");
  }
}

/**
 * Purge a single builder's data.
 * This permanently deletes all collections, queries, and the builder document.
 */
async function purgeBuilder(bindings: AppBindings, builderId: string): Promise<void> {
  const { log } = bindings;
  const claimId = crypto.randomUUID();
  const staleClaimBefore = new Date(Date.now() - PURGE_LEASE_MS);
  const claimed = await E.runPromise(
    BuildersRepository.claimBuilderForPurge(bindings, builderId, claimId, staleClaimBefore),
  );
  if (!claimed) {
    log.info("Builder %s is no longer eligible for purge, skipping", builderId);
    return;
  }

  log.warn("Purging builder %s", builderId);

  try {
    await E.runPromise(CollectionsService.deleteBuilderCollections(bindings, builderId));
    await E.runPromise(QueriesService.deleteBuilderQueries(bindings, builderId));
    await E.runPromise(BuildersRepository.deleteClaimedBuilder(bindings, builderId, claimId));
    log.warn("Builder %s purged successfully", builderId);
  } catch (error) {
    await pipe(
      BuildersRepository.releasePurgeClaim(bindings, builderId, claimId),
      E.catchAll((releaseError) => {
        log.error({ releaseError, builderId }, "Failed to release purge claim");
        return E.succeed(void 0);
      }),
      E.runPromise,
    );
    throw error;
  }
}

/**
 * Start the purge worker.
 * Runs purge cycles on a daily interval.
 */
export function startPurgeWorker(bindings: AppBindings): NodeJS.Timeout | null {
  const { config, log } = bindings;

  if (!hasFeatureFlag(config.enabledFeatures, FeatureFlag.CREDITS)) {
    log.info("Credits feature not enabled, skipping purge worker");
    return null;
  }

  log.info("Starting purge worker (interval: %d ms, grace period: %d days)", PURGE_INTERVAL_MS, config.gracePeriodDays);

  // Run on interval (don't run immediately on startup to avoid accidental purges during deployment)
  return setInterval(() => {
    void runPurgeCycle(bindings);
  }, PURGE_INTERVAL_MS);
}
