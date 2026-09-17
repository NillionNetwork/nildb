/** Backfill query-run owners so result reads can enforce tenant isolation. */

const CollectionName = {
  Queries: "queries",
  QueryRuns: "query_runs",
};

export async function up(_db, client) {
  if (!process.env.APP_DB_NAME_BASE) {
    throw new Error("process.env.APP_DB_NAME_BASE is undefined");
  }

  const db = client.db(process.env.APP_DB_NAME_BASE);
  const queries = db.collection(CollectionName.Queries);
  const runs = db.collection(CollectionName.QueryRuns);

  console.log("! Backfilling query-run owners");
  let updated = 0;
  for await (const run of runs.find({ owner: { $exists: false } }, { projection: { query: 1 } })) {
    const query = await queries.findOne({ _id: run.query }, { projection: { owner: 1 } });
    if (query?.owner) {
      const result = await runs.updateOne(
        { _id: run._id, owner: { $exists: false } },
        { $set: { owner: query.owner } },
      );
      updated += result.modifiedCount;
    }
  }
  console.log(`  - Backfilled ${updated} query run owner(s)`);
}

export async function down(_db, client) {
  if (!process.env.APP_DB_NAME_BASE) {
    throw new Error("process.env.APP_DB_NAME_BASE is undefined");
  }

  const db = client.db(process.env.APP_DB_NAME_BASE);
  await db.collection(CollectionName.QueryRuns).updateMany({}, { $unset: { owner: "" } });
  console.log("! Rollback complete");
}
