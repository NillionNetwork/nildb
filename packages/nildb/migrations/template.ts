import type { MigrationInterface } from "mongo-migrate-ts";
import type { Db, MongoClient } from "mongodb";

/**
 * Brief description
 */
export class MigrationTemplate implements MigrationInterface {
  public async up(_db: Db, client: MongoClient): Promise<void> {
    const session = client.startSession();
    try {
      await session.withTransaction(async () => {
        //
      });
    } finally {
      await session.endSession();
    }
  }

  public async down(_db: Db, client: MongoClient): Promise<void> {
    const session = client.startSession();
    try {
      await session.withTransaction(async () => {
        //
      });
    } finally {
      await session.endSession();
    }
  }
}
