/**
 * Migration to normalise payment transaction hashes to lowercase.
 *
 * Ethereum resolves transaction hashes case-insensitively, but the
 * {txHash, chainId} unique index compares bytes. Before this change the same
 * burn could be registered once per casing variant, crediting it repeatedly.
 *
 * This migration lowercases stored hashes so the unique index starts
 * enforcing what it was intended to enforce. Where lowercasing would collide
 * with an existing row, the collision is a payment that was very likely
 * double-credited: the row is left untouched and reported, because deciding
 * whether to claw back credits is an operator decision, not a migration's.
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

  const dbNamePrimary = process.env.APP_DB_NAME_BASE;
  const db = client.db(dbNamePrimary);
  const payments = db.collection(CollectionName.Payments);

  console.log("! Normalising payment transaction hashes to lowercase");

  // Only rows that actually contain an uppercase hex character need touching.
  const cursor = payments.find({ txHash: { $regex: "[A-F]" } });

  let normalised = 0;
  const collisions = [];

  for await (const payment of cursor) {
    const lowered = payment.txHash.toLowerCase();

    const existing = await payments.findOne({
      txHash: lowered,
      chainId: payment.chainId,
      _id: { $ne: payment._id },
    });

    if (existing) {
      collisions.push({
        keptId: existing._id.toString(),
        duplicateId: payment._id.toString(),
        txHash: lowered,
        chainId: payment.chainId,
        duplicateAmountUsd: payment.amountUsd,
        duplicatePayerDid: payment.payerDid,
      });
      continue;
    }

    await payments.updateOne({ _id: payment._id }, { $set: { txHash: lowered } });
    normalised++;
  }

  console.log(`  - Normalised ${normalised} payment hash(es)`);

  if (collisions.length > 0) {
    console.warn(
      `  - WARNING: ${collisions.length} payment(s) collide with an existing lowercase hash and were left unchanged.`,
    );
    console.warn("    These are duplicate registrations of the same on-chain burn and were credited more than once.");
    console.warn("    Review and reconcile the balances manually:");
    for (const collision of collisions) {
      console.warn(`    ${JSON.stringify(collision)}`);
    }
  }

  console.log("! Payment transaction hash normalisation complete");
}

/**
 * Rollback migration.
 *
 * Lowercasing is not reversible (the original casing is not retained) and the
 * lowercase form is the canonical one, so this is intentionally a no-op.
 */
export async function down(_db, _client) {
  console.log("! Payment transaction hash normalisation is not reversible; nothing to roll back");
}
