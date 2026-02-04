/**
 * Migration to add credit system collections.
 *
 * Creates:
 * - payments: Records processed payment transactions
 * - revocations: Local token revocation list
 *
 * Also adds optional credit-related fields to builders collection.
 */

const CollectionName = {
  Payments: "payments",
  Revocations: "revocations",
  Builders: "builders",
};

/**
 * Main migration function.
 */
export async function up(_db, client) {
  if (!process.env.APP_DB_NAME_BASE) {
    throw new Error("process.env.APP_DB_NAME_BASE is undefined");
  }

  const dbNamePrimary = process.env.APP_DB_NAME_BASE;
  const db = client.db(dbNamePrimary);

  console.log("! Running credits system migration");

  // Create payments collection
  console.log("  - Creating payments collection...");
  await db.createCollection(CollectionName.Payments);

  // Create unique compound index on txHash + chainId for replay prevention
  await db
    .collection(CollectionName.Payments)
    .createIndex({ txHash: 1, chainId: 1 }, { unique: true, name: "txHash_chainId_unique" });

  // Index for looking up payments by payer
  await db.collection(CollectionName.Payments).createIndex({ payerDid: 1 }, { name: "payerDid_1" });

  // Index for analytics/auditing by process time
  await db.collection(CollectionName.Payments).createIndex({ processedAt: 1 }, { name: "processedAt_1" });

  console.log("  - Successfully created payments collection with 3 indexes");

  // Create revocations collection
  console.log("  - Creating revocations collection...");
  await db.createCollection(CollectionName.Revocations);

  // Unique index on token hash
  await db
    .collection(CollectionName.Revocations)
    .createIndex({ tokenHash: 1 }, { unique: true, name: "tokenHash_unique" });

  // TTL index for automatic cleanup of expired revocations
  await db
    .collection(CollectionName.Revocations)
    .createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0, name: "expiresAt_ttl" });

  console.log("  - Successfully created revocations collection with 2 indexes");

  // Create index on builders.status for billing worker queries
  console.log("  - Creating index on builders for billing queries...");
  await db
    .collection(CollectionName.Builders)
    .createIndex({ status: 1, lastBillingCycle: 1 }, { name: "status_lastBillingCycle_1", sparse: true });

  console.log("  - Successfully created builder billing index");

  console.log("! Credits system migration complete");
}

/**
 * Rollback migration.
 */
export async function down(_db, client) {
  if (!process.env.APP_DB_NAME_BASE) {
    throw new Error("process.env.APP_DB_NAME_BASE is undefined");
  }

  const dbNamePrimary = process.env.APP_DB_NAME_BASE;
  const db = client.db(dbNamePrimary);

  console.log("! Rolling back credits system migration");

  // Drop collections
  await db.dropCollection(CollectionName.Payments).catch(() => {});
  await db.dropCollection(CollectionName.Revocations).catch(() => {});

  // Drop builder billing index
  await db
    .collection(CollectionName.Builders)
    .dropIndex("status_lastBillingCycle_1")
    .catch(() => {});

  console.log("! Rollback complete");
}
