/**
 * Consolidated initialization migration for nilDB.
 *
 * This migration handles two scenarios:
 * 1. Fresh installation: Creates all collections with final schema
 * 2. Upgrade from v1.1.2: Validates version and migrates changelog from mongo-migrate-ts
 *
 * IMPORTANT: Versions older than v1.1.2 MUST first upgrade to v1.1.2 before upgrading to this version.
 */

import { ObjectId } from "mongodb";

const CollectionName = {
  Builders: "builders",
  Collections: "collections",
  Queries: "queries",
  QueryRuns: "query_runs",
  Config: "config",
  Users: "users",
};

// Expected migrations from v1.1.2 (using mongo-migrate-ts)
const EXPECTED_V112_MIGRATIONS = [
  "20250522_1000_init",
  "20250626_1200_rename_user_collection",
  "20251021_1000_did_migration",
  "20251022_1200_add_builder_did_index",
  "20251022_1300_add_user_did_index",
];

/**
 * Checks if this is an upgrade from v1.1.2 by looking for the old `migrations_changelog` collection.
 */
async function isUpgradeFromV112(db) {
  const collections = await db
    .listCollections({ name: "migrations_changelog" })
    .toArray();
  return collections.length > 0;
}

/**
 * Validates that the `migrations_changelog` contains exactly the expected v1.1.2 migrations to enforce
 * upgrading from the correct version.
 */
async function validateV112Migrations(db) {
  const changelog = db.collection("migrations_changelog");
  const migrations = await changelog.find({}).sort({ appliedAt: 1 }).toArray();

  console.log(
    `  - Found ${migrations.length} migrations in migrations_changelog`,
  );

  if (migrations.length !== EXPECTED_V112_MIGRATIONS.length) {
    throw new Error(
      `Expected ${EXPECTED_V112_MIGRATIONS.length} migrations from v1.1.2, found ${migrations.length}. You must upgrade to v1.1.2 before upgrading to this version.`,
    );
  }

  // Validate each migration name matches expected
  const migrationNames = migrations.map((m) =>
    m.file.replace(/\.(ts|mjs)$/, ""),
  );
  for (let i = 0; i < EXPECTED_V112_MIGRATIONS.length; i++) {
    if (migrationNames[i] !== EXPECTED_V112_MIGRATIONS[i]) {
      throw new Error(
        `Migration mismatch at position ${i}: expected "${EXPECTED_V112_MIGRATIONS[i]}", found "${migrationNames[i]}". Database may not be from v1.1.2.`,
      );
    }
  }

  console.log("  - Validated all v1.1.2 migrations present");
  return true;
}

/**
 * Creates all collections for a fresh installation.
 */
async function createCollections(db) {
  console.log("  - Creating collections...");

  await Promise.all([
    db.createCollection(CollectionName.Builders),
    db.createCollection(CollectionName.Queries),
    db.createCollection(CollectionName.Collections),
    db.createCollection(CollectionName.Config),
    db.createCollection(CollectionName.QueryRuns),
    db.createCollection(CollectionName.Users),
  ]);

  console.log("  - Successfully created 6 collections");
}

/**
 * Creates all indexes for a fresh installation.
 */
async function createIndexes(db) {
  console.log("  - Creating indexes...");

  // TTL index on query_runs for automatic cleanup
  await db.collection(CollectionName.QueryRuns).createIndex(
    { _created: 1 },
    {
      name: "_created_1",
      expireAfterSeconds: 5400,
      unique: false,
    },
  );

  // Unique index on builders.did
  await db
    .collection(CollectionName.Builders)
    .createIndex({ did: 1 }, { unique: true });

  // Unique index on users.did
  await db
    .collection(CollectionName.Users)
    .createIndex({ did: 1 }, { unique: true });

  console.log("  - Successfully created 3 indexes");
}

/**
 * Inserts a version document into the config collection.
 */
async function insertVersionDocument(db, version) {
  console.log(`  - Inserting version document: ${version}`);

  await db.collection(CollectionName.Config).insertOne({
    _id: new ObjectId(),
    key: "schema_version",
    value: version,
    _created: new Date(),
    _updated: new Date(),
  });
}

/**
 * Main migration function.
 */
export async function up(_db, client) {
  if (!process.env.APP_DB_NAME_BASE) {
    throw new Error("process.env.APP_DB_NAME_BASE is undefined");
  }

  const dbNamePrimary = process.env.APP_DB_NAME_BASE;
  const db = client.db(dbNamePrimary);

  console.log("! Running consolidated init migration");

  const isUpgrade = await isUpgradeFromV112(db);

  if (isUpgrade) {
    console.log("! Detected upgrade from v1.1.2");

    // Validate the migrations_changelog collection
    await validateV112Migrations(db);

    // Drop the old migrations_changelog collection
    console.log("  - Dropping old migrations_changelog collection");
    await db.dropCollection("migrations_changelog");

    console.log("! Successfully migrated from v1.1.2");
    console.log("  - All collections and indexes already exist from v1.1.2");
  } else {
    console.log("! Fresh installation detected");

    // Create all collections
    await createCollections(db);

    // Create all indexes
    await createIndexes(db);

    // Insert version document
    await insertVersionDocument(db, "1.2.0");

    console.log("! Successfully initialized fresh database");
  }
}

/**
 * Rollback is not supported for this migration.
 * For fresh installs, manually drop the database.
 * For upgrades from v1.1.2, restore from backup.
 */
export async function down(_db, _client) {
  throw new Error(
    "Rollback not supported. For fresh installs, drop the database. For upgrades, restore from backup taken before migration.",
  );
}
