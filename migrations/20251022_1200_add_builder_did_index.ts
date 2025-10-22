import type { MigrationInterface } from "mongo-migrate-ts";
import type { Db, MongoClient } from "mongodb";
import { CollectionName } from "#/common/mongo";
import { checkTransactionSupport } from "./utils";

/**
 * Adds a unique index to the `did` field of the `builders` collection.
 * This migration is environment-aware: it uses an atomic transaction on replica sets
 * but proceeds without one on standalone instances to support local development.
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
    const primary = client.db(this.#dbNamePrimary);
    const hasTxSupport = await checkTransactionSupport(client);

    if (hasTxSupport) {
      console.log(
        "- Transactions supported. Adding unique index within a transaction.",
      );
      const session = client.startSession();
      try {
        await session.withTransaction(async (session) => {
          await primary
            .collection(CollectionName.Builders)
            .createIndex({ did: 1 }, { unique: true, session });
        });
      } finally {
        await session.endSession();
      }
    } else {
      console.warn(
        "- Transactions not supported. Adding unique index without atomicity.",
      );
      await primary
        .collection(CollectionName.Builders)
        .createIndex({ did: 1 }, { unique: true });
    }
    console.log("  - Successfully added unique index to builders.did");
  }

  public async down(_db: Db, client: MongoClient): Promise<void> {
    const primary = client.db(this.#dbNamePrimary);
    const hasTxSupport = await checkTransactionSupport(client);
    const indexName = "did_1";

    if (hasTxSupport) {
      console.log(
        "- Transactions supported. Dropping unique index within a transaction.",
      );
      const session = client.startSession();
      try {
        await session.withTransaction(async (session) => {
          await primary
            .collection(CollectionName.Builders)
            .dropIndex(indexName, { session });
        });
      } finally {
        await session.endSession();
      }
    } else {
      console.warn(
        "- Transactions not supported. Dropping unique index without atomicity.",
      );
      await primary.collection(CollectionName.Builders).dropIndex(indexName);
    }
    console.log("  - Successfully dropped unique index from builders.did");
  }
}
