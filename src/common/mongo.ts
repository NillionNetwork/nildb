import { Effect as E, pipe } from "effect";
import type { Config as MongoMigrateConfig } from "mongo-migrate-ts/lib/config";
import {
  type Collection,
  type Document,
  MongoClient,
  MongoError,
  UUID,
} from "mongodb";
import {
  DataCollectionNotFoundError,
  DatabaseError,
  PrimaryCollectionNotFoundError,
} from "#/common/errors";
import type { UuidDto } from "#/common/types";
import type { AppBindings, EnvVars } from "#/env";

// A common base for all documents. UUID v4 is used so that records have a unique but stable
// identifier across the cluster.
export type DocumentBase = {
  _id: UUID;
  _created: Date;
  _updated: Date;
};

export function completeDocumentBaseFilter(
  filter: Record<string, unknown>,
): Record<string, unknown> {
  const { $coerce, ...remainingFilter } = filter;
  const { _id, _updated, _created, ...remainingCoercions } =
    ($coerce as unknown as Record<string, unknown>) ?? {};
  const coerce = {
    ...remainingCoercions,
    _id: "uuid",
    _created: "date",
    _updated: "date",
  };
  return {
    $coerce: coerce,
    ...remainingFilter,
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
  Accounts = "accounts",
  Schemas = "schemas",
  Queries = "queries",
}

export async function mongoMigrateUp(
  uri: string,
  database: string,
): Promise<void> {
  console.warn("! Database migration check");
  const config: MongoMigrateConfig = {
    uri,
    database,
    migrationsDir: "./migrations",
    globPattern: "[0-9]*_[0-9]*_[a-z]*.ts",
    migrationNameTimestampFormat: "yyyyMMdd_HHmm",
  };

  // mongo-migrate-ts is primarily a CLI tool, but we need to run migrations
  // programmatically on startup and in tests. Using dynamic import here to
  // handle different module resolution between tsx (dist/) and vitest (lib/).
  // additionally, we use a migratePath otherwise tsc complains about type issues in the lib
  const migratePath = "mongo-migrate-ts/lib/commands/up" as const;
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

export function checkPrimaryCollectionExists<T extends Document>(
  ctx: AppBindings,
  name: string,
): E.Effect<Collection<T>, PrimaryCollectionNotFoundError | DatabaseError> {
  return pipe(
    E.tryPromise({
      try: () => ctx.db.primary.listCollections({ name }).toArray(),
      catch: (cause) =>
        new DatabaseError({ cause, message: "checkPrimaryCollectionExists" }),
    }),
    E.flatMap((result) =>
      result.length === 1
        ? E.succeed(ctx.db.primary.collection<T>(name))
        : E.fail(new PrimaryCollectionNotFoundError({ name: name as UuidDto })),
    ),
  );
}

export function checkDataCollectionExists<T extends Document>(
  ctx: AppBindings,
  name: string,
): E.Effect<Collection<T>, DataCollectionNotFoundError | DatabaseError> {
  return pipe(
    E.tryPromise({
      try: () => ctx.db.data.listCollections({ name }).toArray(),
      catch: (cause) =>
        new DatabaseError({ cause, message: "checkDataCollectionExists" }),
    }),
    E.flatMap((result) =>
      result.length === 1
        ? E.succeed(ctx.db.data.collection<T>(name))
        : E.fail(new DataCollectionNotFoundError({ name: name as UuidDto })),
    ),
  );
}

export function applyCoercions<T>(filter: Record<string, unknown>): T {
  if ("$coerce" in filter) {
    const { $coerce, ...coercedFilter } = filter;
    if ($coerce && typeof $coerce === "object") {
      for (const field in $coerce) {
        const type = $coerce[field as keyof typeof $coerce];
        applyCoercionToField(coercedFilter, field, type);
      }
    }
    return coercedFilter as unknown as T;
  }
  return filter as unknown as T;
}

function applyCoercionToField(
  filter: Record<string, unknown>,
  field: string,
  type: string,
) {
  if (field in filter) {
    if (typeof filter[field] === "object") {
      const value = filter[field] as unknown as Record<string, unknown>;
      for (const op in value) {
        if (op.startsWith("$") && Array.isArray(value[op])) {
          value[op] = Array.from(value[op]).map((innerValue) =>
            toPrimitiveValue(innerValue, type),
          );
        }
      }
    } else {
      filter[field] = toPrimitiveValue(filter[field], type);
    }
  }
}

function toPrimitiveValue(value: unknown, type: string): unknown {
  if (typeof value === "string") {
    switch (type.toLowerCase()) {
      case "uuid":
        return new UUID(value);
      case "date":
        return new Date(value);
    }
  }
  return value;
}
