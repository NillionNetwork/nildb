import path from "node:path";
import { fileURLToPath } from "node:url";
import { Effect as E, pipe } from "effect";
import type { Config as MongoMigrateConfig } from "mongo-migrate-ts/lib/config";
import {
  type Collection,
  type Document,
  MongoClient,
  MongoError,
  type UUID,
} from "mongodb";
import { CollectionNotFoundError, DatabaseError } from "#/common/errors";
import type { UuidDto } from "#/common/types";
import type { AppBindings, EnvVars } from "#/env";
import type { CoercibleMap } from "./coercion.js";

// A common base for all documents. UUID v4 is used so that records have a unique but stable
// identifier across the cluster.
export type DocumentBase<I = UUID> = {
  _id: I;
  _created: Date;
  _updated: Date;
};

export function addDocumentBaseCoercions(
  coercibleMap: CoercibleMap,
): CoercibleMap {
  const { $coerce, ...document } = coercibleMap;
  const { _id, _updated, _created, ...remainingCoercions } = $coerce ?? {};

  const newCoercions: Record<
    string,
    "string" | "number" | "boolean" | "date" | "uuid"
  > = {
    ...remainingCoercions,
    _created: "date",
    _updated: "date",
  };

  // Only add coercion if the field exists and is a string that needs to be converted.
  // This prevents incorrect coercion of UUID objects or query operator objects.
  if (typeof document._id === "string") {
    newCoercions._id = "uuid";
  }
  if (typeof document._created === "string") {
    newCoercions._created = "date";
  }
  if (typeof document._updated === "string") {
    newCoercions._updated = "date";
  }
  return {
    $coerce: newCoercions,
    ...document,
  };
}

export async function initAndCreateDbClients(
  env: EnvVars,
): Promise<AppBindings["db"]> {
  const client = await MongoClient.connect(env.dbUri);
  const primary = client.db(env.dbNamePrimary);
  const data = client.db(env.dbNameData);

  return {
    client,
    primary,
    data,
  };
}

export enum CollectionName {
  Builders = "builders",
  Collections = "collections",
  Queries = "queries",
  QueryRuns = "query_runs",
  Config = "config",
  Users = "users",
}

export async function mongoMigrateUp(
  uri: string,
  database: string,
): Promise<void> {
  console.warn("! Database migration check");
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const migrationsDir = path.join(__dirname, "../../migrations");
  const config: MongoMigrateConfig = {
    uri,
    database,
    migrationsDir,
    globPattern: "[0-9]*_[0-9]*_[a-z]*.ts",
    migrationNameTimestampFormat: "yyyyMMdd_HHmm",
  };

  // mongo-migrate-ts is primarily a CLI tool, but we need to run migrations
  // programmatically on startup and in tests. Using dynamic import here to
  // handle different module resolution. Vitest 4 requires the compiled dist path.
  // additionally, we use a migratePath otherwise tsc complains about type issues in the lib
  const migratePath = "mongo-migrate-ts/dist/lib/commands/up" as const;
  const migrate = await import(migratePath);
  await migrate.up({ config });
}

export function isMongoError(value: unknown): value is MongoError {
  return value instanceof MongoError;
}

export const MongoErrorCode = {
  Duplicate: 11000,
  CannotCreateIndex: 67,
  IndexNotFound: 27,
} as const;

export function checkCollectionExists<T extends Document>(
  ctx: AppBindings,
  dbName: "primary" | "data",
  collectionName: string,
): E.Effect<Collection<T>, CollectionNotFoundError | DatabaseError> {
  const db = ctx.db[dbName];

  if (!db) {
    return E.fail(
      new CollectionNotFoundError({
        dbName,
        name: collectionName as UuidDto,
      }),
    );
  }

  return pipe(
    E.tryPromise({
      try: () => db.listCollections({ name: collectionName }).toArray(),
      catch: (cause) =>
        new DatabaseError({
          cause,
          message: `check${collectionName[0].toUpperCase() + collectionName.slice(1)}CollectionExists`,
        }),
    }),
    E.flatMap((result) =>
      result.length === 1
        ? E.succeed(db.collection<T>(collectionName))
        : E.fail(
            new CollectionNotFoundError({
              dbName,
              name: collectionName as UuidDto,
            }),
          ),
    ),
  );
}
