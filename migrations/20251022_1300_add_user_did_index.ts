import type { MigrationInterface } from "mongo-migrate-ts";
import type { Db, MongoClient } from "mongodb";
import { CollectionName } from "#/common/mongo";

/**
 * Adds a unique index to the `did` field of the `users` collection.
 * This enforces a business rule that each user must have a unique Did.
 * Note: Index creation cannot be part of a multi-document transaction.
 */
export class add_user_did_index implements MigrationInterface {
  #dbNamePrimary: string;

  constructor() {
    if (!process.env.APP_DB_NAME_BASE) {
      throw new Error("process.env.APP_DB_NAME_BASE is undefined");
    }
    this.#dbNamePrimary = process.env.APP_DB_NAME_BASE;
  }

  public async up(_db: Db, client: MongoClient): Promise<void> {
    console.log("! Adding unique index to users.did");
    const primary = client.db(this.#dbNamePrimary);
    await primary
      .collection(CollectionName.Users)
      .createIndex({ did: 1 }, { unique: true });
    console.log("  - Successfully added unique index to users.did");
  }

  public async down(_db: Db, client: MongoClient): Promise<void> {
    console.log("! Dropping unique index from users.did");
    const primary = client.db(this.#dbNamePrimary);
    await primary.collection(CollectionName.Users).dropIndex("did_1");
    console.log("  - Successfully dropped unique index from users.did");
  }
}
