import { Effect as E, pipe } from "effect";
import type { Config as MongoMigrateConfig } from "mongo-migrate-ts/lib/config";
import {
  type Collection,
  type Db,
  type Document,
  MongoClient,
  MongoError,
  UUID,
} from "mongodb";
import { z } from "zod";
import {
  CollectionNotFoundError,
  DatabaseError,
  DataValidationError,
} from "#/common/errors";
import {
  type CoercibleMap,
  type CoercibleTypes,
  type CoercibleValues,
  Uuid,
  type UuidDto,
} from "#/common/types";
import type { AppBindings, EnvVars } from "#/env";

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
  return {
    $coerce: {
      ...remainingCoercions,
      _id: "uuid",
      _created: "date",
      _updated: "date",
    },
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

export function checkCollectionExists<T extends Document>(
  ctx: AppBindings,
  dbName: string,
  name: string,
): E.Effect<Collection<T>, CollectionNotFoundError | DatabaseError> {
  const dbRegister = ctx.db as Record<string, unknown>;
  if (!(dbName in dbRegister)) {
    return E.fail(
      new CollectionNotFoundError({
        dbName,
        name: name as UuidDto,
      }),
    );
  }
  const db = dbRegister[dbName] as Db;
  return pipe(
    E.tryPromise({
      try: () => db.listCollections({ name }).toArray(),
      catch: (cause) =>
        new DatabaseError({
          cause,
          message: `check${name[0].toUpperCase() + name.slice(1)}CollectionExists`,
        }),
    }),
    E.flatMap((result) =>
      result.length === 1
        ? E.succeed(db.collection<T>(name))
        : E.fail(
            new CollectionNotFoundError({ dbName, name: name as UuidDto }),
          ),
    ),
  );
}

export function applyCoercions<T>(
  coercibleMap: CoercibleMap,
): E.Effect<T, DataValidationError> {
  if ("$coerce" in coercibleMap) {
    const { $coerce, ...coercibleValues } = coercibleMap;
    if ($coerce && typeof $coerce === "object") {
      return E.forEach(Object.entries($coerce), ([key, type]) =>
        applyCoercionToField(coercibleValues, key, type),
      ).pipe(E.map(() => coercibleValues as unknown as T));
    }
  }
  return E.succeed(coercibleMap as unknown as T);
}

function applyCoercionToField(
  coercibleValues: CoercibleValues,
  field: string,
  type: CoercibleTypes,
): E.Effect<CoercibleMap, DataValidationError> {
  const applyCoercionToArrayItems = (
    array: Array<unknown>,
  ): E.Effect<unknown, DataValidationError> => {
    return E.forEach(array, (item) => coerceValue(item, type));
  };

  if (coercibleValues[field]) {
    let container = coercibleValues;
    let coercibleField = field;
    let value = container[coercibleField];
    if (typeof value === "object") {
      for (const key in value) {
        if (key.startsWith("$")) {
          container = container[coercibleField] as Record<string, unknown>;
          coercibleField = key;
          value = container[coercibleField];
          break;
        }
      }
    }
    if (Array.isArray(value)) {
      return applyCoercionToArrayItems(Array.from(value)).pipe(
        E.map((result) => {
          container[coercibleField] = result;
          return coercibleValues;
        }),
      );
    }
    return coerceValue(container[coercibleField], type).pipe(
      E.map((result) => {
        container[coercibleField] = result;
        return coercibleValues;
      }),
    );
  }
  return E.succeed(coercibleValues);
}

function coerceValue(
  value: unknown,
  type: string,
): E.Effect<unknown, DataValidationError> {
  let result:
    | { data: unknown; success: true }
    | { success: false; error: z.ZodError };

  switch (type.toLowerCase()) {
    case "string":
      result = z.string().safeParse(`${value}`);
      break;
    case "number":
      result = z
        .preprocess((arg) => {
          if (arg === null || arg === undefined) return undefined;
          return Number(arg);
        }, z.number())
        .safeParse(value);
      break;
    case "boolean":
      result = z
        .preprocess((arg) => {
          if (typeof arg === "boolean") return Boolean(arg);
          if (typeof arg === "number" && (arg === 0 || arg === 1))
            return Boolean(arg);
          if (
            typeof arg === "string" &&
            (arg.toLowerCase() === "true" || arg.toLowerCase() === "false")
          )
            return true;
          return undefined;
        }, z.boolean())
        .safeParse(value);
      break;
    case "uuid":
      if (typeof value === "string") {
        result = Uuid.safeParse(value);
      } else if (value instanceof UUID) {
        result = Uuid.safeParse(value.toString());
      } else {
        const issues = ["value is not a valid UUID"];
        const error = new DataValidationError({
          issues,
          cause: { value, type },
        });
        return E.fail(error);
      }
      break;
    case "date":
      result = z
        .preprocess((arg) => {
          if (arg === null || arg === undefined) return undefined;
          if (typeof arg !== "string") return undefined;
          return new Date(arg);
        }, z.date())
        .safeParse(value);
      break;
    default: {
      const issues = ["Unsupported type coercion"];
      const error = new DataValidationError({
        issues,
        cause: { value, type },
      });
      return E.fail(error);
    }
  }
  if (result.success) {
    return E.succeed(result.data);
  }
  const error = new DataValidationError({
    issues: [result.error],
    cause: null,
  });
  return E.fail(error);
}
