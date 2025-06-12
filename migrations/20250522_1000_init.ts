import type { MigrationInterface } from "mongo-migrate-ts";
import type { Db, MongoClient } from "mongodb";
import { CollectionName } from "#/common/mongo";

/**
 * Setup/teardown primary collections
 */
export class init_collections implements MigrationInterface {
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
        await Promise.all([
          primary.createCollection(CollectionName.Builders),
          primary.createCollection(CollectionName.Queries),
          primary.createCollection(CollectionName.Schemas),
          primary.createCollection(CollectionName.Config),
          primary.createCollection(CollectionName.QueryRuns),
          primary.createCollection(CollectionName.User),
        ]);

        await primary.collection(CollectionName.QueryRuns).createIndexes([
          {
            key: { _created: 1 },
            name: "_created_1",
            expireAfterSeconds: 5400,
            unique: false,
          },
        ]);
      });
    } finally {
      await session.endSession();
    }
  }

  public async down(_db: Db, client: MongoClient): Promise<void> {
    const primary = client.db(this.#dbNamePrimary);
    const session = client.startSession();
    try {
      await Promise.all([
        primary.dropCollection(CollectionName.Builders),
        primary.dropCollection(CollectionName.Queries),
        primary.dropCollection(CollectionName.Schemas),
        primary.dropCollection(CollectionName.Config),
        primary.dropCollection(CollectionName.QueryRuns),
        primary.dropCollection(CollectionName.User),
      ]);
    } finally {
      await session.endSession();
    }
  }
}
