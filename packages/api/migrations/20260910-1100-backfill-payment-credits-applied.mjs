/**
 * Migration to backfill `creditsApplied` on existing payments.
 *
 * New payments are inserted with `creditsApplied: false` and flipped to true
 * once the balance update lands, so a retry can finish a payment that would
 * otherwise be marked processed forever without the builder being credited.
 *
 * Every payment that predates that flag was written by the previous flow,
 * which applied credits immediately after insert, so they are treated as
 * applied. Leaving them unset would let a replay be mistaken for a resume.
 */

const CollectionName = {
  Payments: "payments",
};

/**
 * Main migration function.
 */
export async function up(_db, client) {
  if (!process.env.APP_DB_NAME_BASE) {
    throw new Error("process.env.APP_DB_NAME_BASE is undefined");
  }

  const db = client.db(process.env.APP_DB_NAME_BASE);

  console.log("! Backfilling creditsApplied on existing payments");

  const result = await db
    .collection(CollectionName.Payments)
    .updateMany({ creditsApplied: { $exists: false } }, { $set: { creditsApplied: true } });

  console.log(`  - Marked ${result.modifiedCount} existing payment(s) as applied`);
  console.log("! Payment backfill complete");
}

/**
 * Rollback migration.
 */
export async function down(_db, client) {
  if (!process.env.APP_DB_NAME_BASE) {
    throw new Error("process.env.APP_DB_NAME_BASE is undefined");
  }

  const db = client.db(process.env.APP_DB_NAME_BASE);
  await db.collection(CollectionName.Payments).updateMany({}, { $unset: { creditsApplied: "" } });

  console.log("! Rollback complete");
}
