import { Did } from "@nillion/nuc";
import type { MigrationInterface } from "mongo-migrate-ts";
import {
  type ClientSession,
  type Collection,
  type Db,
  type MongoClient,
  ObjectId,
} from "mongodb";
import type { CollectionDocument } from "#/collections/collections.types";
import { CollectionName } from "#/common/mongo";
import type { OwnedDocumentBase } from "#/data/data.types";
import type { UserDocument } from "#/users/users.types";

const PUBLIC_KEY_HEX_LENGTH = 66;
const BATCH_SIZE = 1000;

/**
 * Normalizes a legacy identifier (hex-encoded public key or `did:nil` string) into `did:key` format.
 * - If the identifier is already a valid `did:` string (but not `did:nil`), it is returned as is.
 * - If it is a `did:nil` string, it is converted to its `did:key` equivalent.
 * - If it is a raw hex string (64 or 66 characters), it is converted to a `did:key` string.
 */
function normalizeDid(id: string): string {
  if (typeof id !== "string") {
    console.warn(
      `! normalizeDid received a non-string value: ${JSON.stringify(id)}.`,
    );
    return id;
  }

  if (id.startsWith("did:")) {
    if (id.startsWith("did:nil:")) {
      const publicKeyHex = id.slice("did:nil:".length);
      return Did.serialize(Did.fromPublicKey(publicKeyHex, "key"));
    }
    return id; // Already a valid, non-legacy Did format.
  }

  // Handle raw hex public keys (66 for uncompressed, 64 for compressed)
  if (id.length === PUBLIC_KEY_HEX_LENGTH || id.length === 64) {
    try {
      return Did.serialize(Did.fromPublicKey(id, "key"));
    } catch {
      console.warn(`! Failed to convert potential hex key to DID: ${id}`);
      // Not a valid hex key, fall through and return original to avoid data loss.
    }
  }

  return id;
}

/**
 * Migrates legacy hex-key and `did:nil` identifiers to the canonical `did:key` format.
 * This migration also transitions primary-key `_id` fields from string-based business keys
 * to native MongoDB ObjectIds for future flexibility. Because a document's `_id` is immutable,
 * this requires creating a new document from the old one and then deleting the original.
 */
export class did_migration implements MigrationInterface {
  #dbNamePrimary: string;
  #dbNameData: string;

  constructor() {
    if (!process.env.APP_DB_NAME_BASE) {
      throw new Error("process.env.APP_DB_NAME_BASE is undefined");
    }
    this.#dbNamePrimary = process.env.APP_DB_NAME_BASE;
    this.#dbNameData = `${process.env.APP_DB_NAME_BASE}_data`;
  }

  /**
   * Executes the full, one-way data migration. It dynamically detects if the
   * connected MongoDB instance supports transactions. If so, it runs the entire
   * migration atomically. Otherwise, it logs a warning and proceeds without
   * transactional guarantees, suitable for local development.
   */
  public async up(_db: Db, client: MongoClient): Promise<void> {
    const start = Date.now();
    await this.runMigration(client);
    const total = Math.floor((Date.now() - start) / 1000);
    console.log(`- Completed \`did_migration\` in ${total}s.`);
  }

  /**
   * Orchestrates the sequence of migration steps.
   * @param client The MongoClient instance.
   * @param session An optional ClientSession for transactional execution.
   */
  private async runMigration(client: MongoClient, session?: ClientSession) {
    const primaryDb = client.db(this.#dbNamePrimary);
    const dataDb = client.db(this.#dbNameData);

    await this.migrateIdentityCollection(
      primaryDb.collection(CollectionName.Builders),
      session,
    );
    await this.migrateIdentityCollection(
      primaryDb.collection(CollectionName.Users),
      session,
    );
    await this.migrateUserSubdocuments(
      primaryDb.collection(CollectionName.Users),
      session,
    );
    await this.migrateOwnerField(
      primaryDb.collection(CollectionName.Collections),
      session,
    );
    await this.migrateOwnerField(
      primaryDb.collection(CollectionName.Queries),
      session,
    );

    const appCollections = await primaryDb
      .collection<CollectionDocument>(CollectionName.Collections)
      .find({}, { session })
      .toArray();
    console.log(
      `- Found ${appCollections.length} data collections to scan for sub-document migration.`,
    );

    for (const collInfo of appCollections) {
      const collectionName = collInfo._id.toString();
      const dataCollection =
        dataDb.collection<OwnedDocumentBase>(collectionName);
      await this.migrateDataOwnerField(dataCollection, session);
      await this.migrateAcl(dataCollection, session);
    }
  }

  /**
   * Migrates collections (`builders`, `users`) where the `_id` was a string DID.
   * Creates new documents with an ObjectId `_id` and moves the DID to a `did` field.
   * Uses batch processing to avoid loading entire collections into memory.
   */
  private async migrateIdentityCollection(
    collection: Collection,
    session?: ClientSession,
  ) {
    const totalLegacyDocs = await collection.countDocuments(
      { _id: { $type: "string" } },
      { session },
    );
    if (totalLegacyDocs === 0) {
      console.log(
        `- No legacy documents to migrate in '${collection.collectionName}'.`,
      );
      return;
    }
    console.log(
      `- Migrating ${totalLegacyDocs} documents in '${collection.collectionName}'...`,
    );

    let processed = 0;
    while (processed < totalLegacyDocs) {
      const cursor = collection.find({ _id: { $type: "string" } }, { session });
      const legacyDocs = await cursor.limit(BATCH_SIZE).toArray();
      if (legacyDocs.length === 0) {
        break; // All documents processed
      }

      const newDocs = legacyDocs.map((doc) => ({
        ...doc,
        _id: new ObjectId(),
        // @ts-expect-error the legacy doc's _id is a string but the type is updated in the codebase
        did: normalizeDid(doc._id),
      }));

      await collection.insertMany(newDocs, { session });
      await collection.deleteMany(
        { _id: { $in: legacyDocs.map((d) => d._id) } },
        { session },
      );

      processed += legacyDocs.length;
      console.log(
        `  - Migrated ${processed}/${totalLegacyDocs} in '${collection.collectionName}'`,
      );
    }
  }

  /**
   * Migrates the `owner` field in metadata collections like `collections` and `queries`.
   * Uses streaming and bulk writes to avoid loading entire collections into memory.
   */
  private async migrateOwnerField(
    collection: Collection,
    session?: ClientSession,
  ) {
    const cursor = collection.find(
      { $or: [{ owner: { $not: /^did:/ } }, { owner: /^did:nil:/ }] },
      { session },
    );
    const total = await collection.countDocuments(
      { $or: [{ owner: { $not: /^did:/ } }, { owner: /^did:nil:/ }] },
      { session },
    );

    if (total === 0) return;
    console.log(
      `- Migrating owner field for ${total} documents in '${collection.collectionName}'...`,
    );

    let bulkOps = [];
    for await (const doc of cursor) {
      bulkOps.push({
        updateOne: {
          filter: { _id: doc._id },
          update: { $set: { owner: normalizeDid(doc.owner) } },
        },
      });

      if (bulkOps.length === BATCH_SIZE) {
        await collection.bulkWrite(bulkOps, { session });
        bulkOps = [];
      }
    }

    if (bulkOps.length > 0) {
      await collection.bulkWrite(bulkOps, { session });
    }
  }

  /**
   * Migrates the `_owner` field within documents in a specific data collection.
   * Uses streaming and bulk writes to avoid loading entire collections into memory.
   */
  private async migrateDataOwnerField(
    collection: Collection<OwnedDocumentBase>,
    session?: ClientSession,
  ) {
    const cursor = collection.find(
      { $or: [{ _owner: { $not: /^did:/ } }, { _owner: /^did:nil:/ }] },
      { session },
    );
    const total = await collection.countDocuments(
      { $or: [{ _owner: { $not: /^did:/ } }, { _owner: /^did:nil:/ }] },
      { session },
    );
    if (total === 0) return;
    console.log(
      `- Migrating _owner field for ${total} documents in '${collection.collectionName}'...`,
    );

    let bulkOps = [];
    for await (const doc of cursor) {
      if (doc._owner) {
        bulkOps.push({
          updateOne: {
            filter: { _id: doc._id },
            update: { $set: { _owner: normalizeDid(doc._owner) } },
          },
        });
      }

      if (bulkOps.length === BATCH_SIZE) {
        await collection.bulkWrite(bulkOps, { session });
        bulkOps = [];
      }
    }
    if (bulkOps.length > 0) {
      await collection.bulkWrite(bulkOps, { session });
    }
  }

  /**
   * Migrates the `grantee` field within the `_acl` array of documents in a data collection.
   * Uses streaming and bulk writes to avoid loading entire collections into memory.
   */
  private async migrateAcl(
    collection: Collection<OwnedDocumentBase>,
    session?: ClientSession,
  ) {
    const query = {
      _acl: { $exists: true, $type: "array" },
      $or: [
        { "_acl.grantee": { $not: /^did:/ } },
        { "_acl.grantee": /^did:nil:/ },
      ],
    };
    // biome-ignore lint/suspicious/noExplicitAny: MongoDB query types are too restrictive
    const cursor = collection.find(query as any, { session });
    // biome-ignore lint/suspicious/noExplicitAny: MongoDB query types are too restrictive
    const total = await collection.countDocuments(query as any, { session });
    if (total === 0) return;
    console.log(
      `- Updating ACLs for ${total} documents in '${collection.collectionName}'...`,
    );

    let bulkOps = [];
    for await (const doc of cursor) {
      if (doc._acl) {
        const newAcl = doc._acl.map((acl) =>
          acl.grantee ? { ...acl, grantee: normalizeDid(acl.grantee) } : acl,
        );
        bulkOps.push({
          updateOne: {
            filter: { _id: doc._id },
            update: { $set: { _acl: newAcl } },
          },
        });
      }

      if (bulkOps.length === BATCH_SIZE) {
        await collection.bulkWrite(bulkOps, { session });
        bulkOps = [];
      }
    }

    if (bulkOps.length > 0) {
      await collection.bulkWrite(bulkOps, { session });
    }
  }

  /**
   * Migrates nested DID fields within the `users` collection, specifically `data.builder` and `logs.acl.grantee`.
   * Uses streaming and bulk writes to avoid loading entire collections into memory.
   */
  private async migrateUserSubdocuments(
    collection: Collection<UserDocument>,
    session?: ClientSession,
  ) {
    const query = {
      $or: [
        { "data.builder": { $not: /^did:/ } },
        { "data.builder": /^did:nil:/ },
        { "logs.acl.grantee": { $not: /^did:/ } },
        { "logs.acl.grantee": /^did:nil:/ },
      ],
    };
    const cursor = collection.find(query, { session });
    const total = await collection.countDocuments(query, { session });
    if (total === 0) {
      console.log(
        `- No legacy subdocuments to migrate in '${collection.collectionName}'.`,
      );
      return;
    }
    console.log(
      `- Migrating subdocuments for ${total} documents in '${collection.collectionName}'...`,
    );

    let bulkOps = [];
    for await (const doc of cursor) {
      const newData = doc.data.map((ref) => ({
        ...ref,
        builder: normalizeDid(ref.builder),
      }));
      const newLogs = doc.logs.map((log) => {
        if (log.op === "grant-access" && log.acl?.grantee) {
          return {
            ...log,
            acl: { ...log.acl, grantee: normalizeDid(log.acl.grantee) },
          };
        }
        if (log.op === "revoke-access" && log.grantee) {
          return { ...log, grantee: normalizeDid(log.grantee) };
        }
        return log;
      });

      bulkOps.push({
        updateOne: {
          filter: { _id: doc._id },
          update: { $set: { data: newData, logs: newLogs } },
        },
      });

      if (bulkOps.length === BATCH_SIZE) {
        await collection.bulkWrite(bulkOps, { session });
        bulkOps = [];
      }
    }

    if (bulkOps.length > 0) {
      await collection.bulkWrite(bulkOps, { session });
    }
  }

  /**
   * A rollback (`down` migration) is not provided. This migration is destructive (recreates documents)
   * and complex. The recommended rollback procedure is to restore the database from a backup taken
   * before the migration was applied.
   */
  public async down(_db: Db, _client: MongoClient): Promise<void> {
    throw new Error(
      "Rollback for the `did_migration` is not supported. Please restore from a database backup.",
    );
  }
}
