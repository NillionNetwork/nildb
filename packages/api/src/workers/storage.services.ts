import type { BuilderDocument } from "@nildb/builders/builders.types";
import type { AppBindings } from "@nildb/env";

/**
 * Calculate the total storage used by a builder's collections.
 * Uses MongoDB's $collStats to get storage information.
 */
export async function calculateBuilderStorage(ctx: AppBindings, builder: BuilderDocument): Promise<number> {
  const { db, log } = ctx;
  let totalBytes = 0;

  for (const collectionId of builder.collections) {
    try {
      const collectionName = collectionId.toString();
      const stats = await db.data
        .collection(collectionName)
        .aggregate([{ $collStats: { storageStats: {} } }])
        .toArray();

      if (stats.length > 0 && stats[0].storageStats) {
        totalBytes += stats[0].storageStats.storageSize ?? 0;
      }
    } catch (error) {
      // Collection might not exist or be inaccessible
      log.debug({ error, collectionId: collectionId.toString() }, "Could not get stats for collection");
    }
  }

  return totalBytes;
}

/**
 * Calculate billable storage (storage above free tier).
 */
export function calculateBillableStorage(totalBytes: number, freeTierBytes: number): number {
  return Math.max(0, totalBytes - freeTierBytes);
}

/**
 * Calculate the cost for storage over a given period.
 *
 * @param billableBytes - Bytes above free tier
 * @param costPerGbHour - USD cost per GB-hour
 * @param hours - Number of hours in the billing period
 * @returns USD cost
 */
export function calculateStorageCost(billableBytes: number, costPerGbHour: number, hours: number): number {
  const billableGb = billableBytes / (1024 * 1024 * 1024);
  return billableGb * costPerGbHour * hours;
}
