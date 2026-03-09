/**
 * Migration to add admin_credit_grants collection.
 *
 * Creates:
 * - admin_credit_grants: Records admin-initiated credit top-ups
 */

const CollectionName = {
  AdminCreditGrants: "admin_credit_grants",
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

  console.log("! Running admin credit grants migration");

  // Create admin_credit_grants collection
  console.log("  - Creating admin_credit_grants collection...");
  await db.createCollection(CollectionName.AdminCreditGrants);

  // Index for looking up grants by builder
  await db.collection(CollectionName.AdminCreditGrants).createIndex({ builderDid: 1 }, { name: "builderDid_1" });

  // Index for auditing by creation time
  await db.collection(CollectionName.AdminCreditGrants).createIndex({ _created: -1 }, { name: "created_desc" });

  console.log("  - Successfully created admin_credit_grants collection with 2 indexes");

  console.log("! Admin credit grants migration complete");
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

  console.log("! Rolling back admin credit grants migration");

  await db.dropCollection(CollectionName.AdminCreditGrants).catch(() => {});

  console.log("! Rollback complete");
}
