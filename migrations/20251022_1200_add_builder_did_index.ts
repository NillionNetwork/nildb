import type { MigrationInterface } from "mongo-migrate-ts";
import type { Db, MongoClient } from "mongodb";
import { CollectionName } from "#/common/mongo";

/**
 * Adds a unique index to the `did` field of the `builders` collection.
 * This restores the uniqueness constraint that was implicitly lost when the
 * primary key `_id` was migrated from the Did string to a native ObjectId.
 * Note: Index creation cannot be part of a multi-document transaction.
 */
export class add_builder_did_index implements MigrationInterface {
  #dbNamePrimary: string;

  constructor() {
    if (!process.env.APP_DB_NAME_BASE) {
      throw new Error("process.env.APP_DB_NAME_BASE is undefined");
    }
    this.#dbNamePrimary = process.env.APP_DB_NAME_BASE;
  }

  public async up(_db: Db, client: MongoClient): Promise<void> {
    console.log("! Adding unique index to builders.did");
    const primary = client.db(this.#dbNamePrimary);
    await primary
      .collection(CollectionName.Builders)
      .createIndex({ did: 1 }, { unique: true });
    console.log("  - Successfully added unique index to builders.did");
  }

  public async down(_db: Db, client: MongoClient): Promise<void> {
    console.log("! Dropping unique index from builders.did");
    const primary = client.db(this.#dbNamePrimary);
    await primary.collection(CollectionName.Builders).dropIndex("did_1");
    console.log("  - Successfully dropped unique index from builders.did");
  }
}
