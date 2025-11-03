import type { MigrationInterface } from "mongo-migrate-ts";
import type { Db, MongoClient } from "mongodb";

/**
 * Rename 'user' collection to 'users'. This was renamed during 1.0.0 development but after
 * some node operators had deployed 1.0.0-rc.0 and so this rename is needed to catch those
 * nodes up.
 */
export class rename_user_collection implements MigrationInterface {
  #dbNamePrimary: string;

  constructor() {
    if (!process.env.APP_DB_NAME_BASE) {
      throw new Error("process.env.APP_DB_NAME_BASE is undefined");
    }
    this.#dbNamePrimary = process.env.APP_DB_NAME_BASE;
  }

  public async up(_db: Db, client: MongoClient): Promise<void> {
    const primary = client.db(this.#dbNamePrimary);
    const session = client.startSession();
    try {
      await session.withTransaction(async () => {
        // FIX: early rc db name was 'user' when it should have been 'users'
        const collections = await primary
          .listCollections({ name: "user" })
          .toArray();

        if (collections.length > 0) {
          console.log("Renaming 'user' collection to 'users'");
          await primary.collection("user").rename("users");
        }
      });
    } finally {
      await session.endSession();
    }
  }

  public async down(_db: Db, client: MongoClient): Promise<void> {
    const primary = client.db(this.#dbNamePrimary);
    const session = client.startSession();
    try {
      await session.withTransaction(async () => {
        // FIX: adding down for completeness
        const collections = await primary
          .listCollections({ name: "users" })
          .toArray();

        if (collections.length > 0) {
          console.log("Renaming 'users' collection to 'user'");
          await primary.collection("users").rename("user");
        }
      });
    } finally {
      await session.endSession();
    }
  }
}
