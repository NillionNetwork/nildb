import path from "node:path";
import { fileURLToPath } from "node:url";
import { CollectionNotFoundError, DatabaseError } from "@nildb/common/errors";
import type { AppBindings, EnvVars } from "@nildb/env";
import type { UuidDto } from "@nillion/nildb-types";
import { Effect as E, pipe } from "effect";
import migrateMongo from "migrate-mongo";
import {
  type Collection,
  type Document,
  MongoClient,
  MongoError,
  type UUID,
} from "mongodb";
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

  migrateMongo.config.set({
    mongodb: {
      url: uri,
      databaseName: database,
    },
    migrationsDir: path.join(__dirname, "../../migrations"),
    changelogCollectionName: "_migrations",
    migrationFileExtension: ".mjs",
    useFileHash: true,
  });

  // Connect to database and run migrations
  const { db, client } = await migrateMongo.database.connect();
  try {
    const migratedFiles = await migrateMongo.up(db, client);
    console.log(
      `Successfully migrated: ${migratedFiles.length > 0 ? migratedFiles.join(", ") : "no new migrations"}`,
    );
  } finally {
    await client.close();
  }
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
