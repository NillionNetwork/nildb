import * as BuildersRepository from "@nildb/builders/builders.repository";
import * as CollectionsService from "@nildb/collections/collections.services";
import { FeatureFlag, hasFeatureFlag, type AppBindings } from "@nildb/env";
import * as QueriesService from "@nildb/queries/queries.services";
import { Effect as E, pipe } from "effect";

const PURGE_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours
const BUILDERS_PER_BATCH = 10; // Limit batch size for safety

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

    const builders = await pipe(
      BuildersRepository.findBuildersPendingPurge(bindings, cutoffDate, BUILDERS_PER_BATCH),
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

  log.warn("Purging builder %s", builderId);

  // Delete all collections (and their data)
  await pipe(
    CollectionsService.deleteBuilderCollections(bindings, builderId),
    E.catchAll((e) => {
      log.error("Failed to delete collections for builder %s: %O", builderId, e);
      return E.succeed(void 0);
    }),
    E.runPromise,
  );

  // Delete all queries
  await pipe(
    QueriesService.deleteBuilderQueries(bindings, builderId),
    E.catchAll((e) => {
      log.error("Failed to delete queries for builder %s: %O", builderId, e);
      return E.succeed(void 0);
    }),
    E.runPromise,
  );

  // Delete the builder document
  await pipe(
    BuildersRepository.deleteOneById(bindings, builderId),
    E.catchAll((e) => {
      log.error("Failed to delete builder document %s: %O", builderId, e);
      return E.succeed(void 0);
    }),
    E.runPromise,
  );

  log.warn("Builder %s purged successfully", builderId);
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
