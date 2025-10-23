import type { MigrationInterface } from "mongo-migrate-ts";
import type { Db, MongoClient } from "mongodb";
import { CollectionName } from "#/common/mongo";
import { checkTransactionSupport } from "./utils";

/**
 * Adds a unique index to the `did` field of the `users` collection.
 * This restores the uniqueness constraint that was implicitly lost when the
 * primary key `_id` was migrated from the DID string to a native ObjectId.
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
    const primary = client.db(this.#dbNamePrimary);
    const hasTxSupport = await checkTransactionSupport(client);

    if (hasTxSupport) {
      const session = client.startSession();
      try {
        await session.withTransaction(async (session) => {
          await primary
            .collection(CollectionName.Users)
            .createIndex({ did: 1 }, { unique: true, session });
        });
      } finally {
        await session.endSession();
      }
    } else {
      await primary
        .collection(CollectionName.Users)
        .createIndex({ did: 1 }, { unique: true });
    }
    console.log("! Successfully added unique index to users.did");
  }

  public async down(_db: Db, client: MongoClient): Promise<void> {
    const primary = client.db(this.#dbNamePrimary);
    const hasTxSupport = await checkTransactionSupport(client);
    const indexName = "did_1";

    if (hasTxSupport) {
      const session = client.startSession();
      try {
        await session.withTransaction(async (session) => {
          await primary
            .collection(CollectionName.Users)
            .dropIndex(indexName, { session });
        });
      } finally {
        await session.endSession();
      }
    } else {
      await primary.collection(CollectionName.Users).dropIndex(indexName);
    }
    console.log("! Successfully dropped unique index from users.did");
  }
}
