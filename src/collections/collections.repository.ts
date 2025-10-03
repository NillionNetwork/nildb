import { Effect as E, pipe } from "effect";
import type {
  CreateIndexesOptions,
  DeleteResult,
  Document,
  IndexSpecification,
  StrictFilter,
  UUID,
} from "mongodb";
import type {
  CollectionDocument,
  CollectionMetadata,
} from "#/collections/collections.types";
import {
  type CollectionNotFoundError,
  DatabaseError,
  type DataValidationError,
  DocumentNotFoundError,
  IndexNotFoundError,
  InvalidIndexOptionsError,
} from "#/common/errors";
import {
  CollectionName,
  checkCollectionExists,
  isMongoError,
  MongoErrorCode,
} from "#/common/mongo";
import type { PaginationQuery } from "#/common/pagination.dto";
import type { AppBindings } from "#/env";

/**
 * Insert collection document.
 */
export function insert(
  ctx: AppBindings,
  document: CollectionDocument,
): E.Effect<void, CollectionNotFoundError | DatabaseError> {
  return pipe(
    checkCollectionExists<CollectionDocument>(
      ctx,
      "primary",
      CollectionName.Collections,
    ),
    E.tryMapPromise({
      try: (collection) => collection.insertOne(document),
      catch: (cause) => new DatabaseError({ cause, message: "insert" }),
    }),
    E.as(void 0),
  );
}

/**
 * Find multiple collections.
 */
export function findMany(
  ctx: AppBindings,
  filter: StrictFilter<CollectionDocument>,
  pagination: PaginationQuery,
): E.Effect<
  [CollectionDocument[], number],
  CollectionNotFoundError | DatabaseError | DataValidationError
> {
  return pipe(
    checkCollectionExists<CollectionDocument>(
      ctx,
      "primary",
      CollectionName.Collections,
    ),
    E.flatMap((collection) =>
      E.all([
        E.tryPromise({
          try: () =>
            collection
              .find(filter)
              .sort(pagination.sort ?? { _created: -1 })
              .limit(pagination.limit)
              .skip(pagination.offset)
              .toArray(),
          catch: (cause) => new DatabaseError({ cause, message: "findMany" }),
        }),
        E.tryPromise({
          try: () => collection.countDocuments(filter),
          catch: (cause) =>
            new DatabaseError({ cause, message: "countDocuments" }),
        }),
      ]),
    ),
  );
}

/**
 * Find all collections matching a filter, without pagination.
 */
export function findAll(
  ctx: AppBindings,
  filter: StrictFilter<CollectionDocument>,
): E.Effect<
  CollectionDocument[],
  CollectionNotFoundError | DatabaseError | DataValidationError
> {
  return pipe(
    checkCollectionExists<CollectionDocument>(
      ctx,
      "primary",
      CollectionName.Collections,
    ),
    E.tryMapPromise({
      try: (collection) => collection.find(filter).toArray(),
      catch: (cause) => new DatabaseError({ cause, message: "findAll" }),
    }),
  );
}

/**
 * Find collection by filter.
 */
export function findOne(
  ctx: AppBindings,
  filter: StrictFilter<CollectionDocument>,
): E.Effect<
  CollectionDocument,
  | DocumentNotFoundError
  | CollectionNotFoundError
  | DatabaseError
  | DataValidationError
> {
  return pipe(
    checkCollectionExists<CollectionDocument>(
      ctx,
      "primary",
      CollectionName.Collections,
    ),
    E.tryMapPromise({
      try: (collection) => collection.findOne(filter),
      catch: (cause) => new DatabaseError({ cause, message: "findOne" }),
    }),
    E.flatMap((result) =>
      result === null
        ? E.fail(
            new DocumentNotFoundError({
              collection: CollectionName.Collections,
              filter,
            }),
          )
        : E.succeed(result),
    ),
  );
}

/**
 * Delete collection.
 */
export function deleteOne(
  ctx: AppBindings,
  filter: StrictFilter<CollectionDocument>,
): E.Effect<
  CollectionDocument,
  | DocumentNotFoundError
  | CollectionNotFoundError
  | DatabaseError
  | DataValidationError
> {
  return pipe(
    checkCollectionExists<CollectionDocument>(
      ctx,
      "primary",
      CollectionName.Collections,
    ),
    E.tryMapPromise({
      try: (collection) => collection.findOneAndDelete(filter),
      catch: (cause) => new DatabaseError({ cause, message: "deleteOne" }),
    }),
    E.flatMap((result) =>
      result === null
        ? E.fail(
            new DocumentNotFoundError({
              collection: CollectionName.Collections,
              filter,
            }),
          )
        : E.succeed(result),
    ),
  );
}

/**
 * Delete many collection.
 */
export function deleteMany(
  ctx: AppBindings,
  filter: StrictFilter<CollectionDocument>,
): E.Effect<
  DeleteResult,
  | DocumentNotFoundError
  | CollectionNotFoundError
  | DatabaseError
  | DataValidationError
> {
  return pipe(
    checkCollectionExists<CollectionDocument>(
      ctx,
      "primary",
      CollectionName.Collections,
    ),
    E.tryMapPromise({
      try: (collection) => collection.deleteMany(filter),
      catch: (cause) => new DatabaseError({ cause, message: "deleteMany" }),
    }),
    E.flatMap((result) =>
      result === null
        ? E.fail(
            new DocumentNotFoundError({
              collection: CollectionName.Collections,
              filter,
            }),
          )
        : E.succeed(result),
    ),
  );
}

/**
 * Get collection statistics.
 */
export function getCollectionStats(
  ctx: AppBindings,
  _id: UUID,
): E.Effect<
  Omit<CollectionMetadata, "schema">,
  CollectionNotFoundError | DatabaseError
> {
  return pipe(
    checkCollectionExists(ctx, "data", _id.toString()),
    E.flatMap((collection) =>
      E.Do.pipe(
        E.bind("timeStats", () =>
          E.tryPromise({
            try: async () => {
              const result = await collection
                .aggregate([
                  {
                    $group: {
                      _id: null,
                      firstWrite: { $min: "$_created" },
                      lastWrite: { $max: "$_created" },
                    },
                  },
                ])
                .toArray();

              if (result.length === 0) {
                return {
                  firstWrite: new Date(0),
                  lastWrite: new Date(0),
                };
              }

              const { firstWrite, lastWrite } = result[0];

              return {
                firstWrite,
                lastWrite,
              };
            },
            catch: (cause) =>
              new DatabaseError({ cause, message: "Failed to get writes" }),
          }),
        ),
        E.bind("indexes", () =>
          E.tryPromise({
            try: async () => {
              const result = await collection.indexes();
              return result.map((index) => ({
                v: index.v ?? -1,
                key: index.key,
                name: index.name ?? "",
                unique: index.unique ?? false,
              }));
            },
            catch: (cause) =>
              new DatabaseError({ cause, message: "Failed to get indexes" }),
          }),
        ),
        E.bind("counts", () =>
          E.tryPromise({
            try: async () => {
              type CollStats = { count: number; size: number };
              const result = await collection
                .aggregate<CollStats>([
                  {
                    $collStats: {
                      storageStats: {},
                    },
                  },
                  {
                    $project: {
                      count: "$storageStats.count",
                      size: "$storageStats.size",
                    },
                  },
                ])
                .toArray();
              const stats = result[0];

              return {
                count: stats.count,
                size: stats.size,
              };
            },
            catch: (cause) =>
              new DatabaseError({ cause, message: "Failed to get counts" }),
          }),
        ),
      ),
    ),
    E.map(({ timeStats, indexes, counts }) => {
      return {
        _id,
        ...timeStats,
        ...counts,
        indexes,
      };
    }),
  );
}

/**
 * Create collection index.
 */
export function createIndex(
  ctx: AppBindings,
  collection: UUID,
  specification: IndexSpecification,
  options: CreateIndexesOptions,
): E.Effect<
  string,
  CollectionNotFoundError | InvalidIndexOptionsError | DatabaseError
> {
  return pipe(
    checkCollectionExists(ctx, "data", collection.toString()),
    E.tryMapPromise({
      try: (collection) => collection.createIndex(specification, options),
      catch: (cause) => {
        if (
          isMongoError(cause) &&
          cause.code === MongoErrorCode.CannotCreateIndex
        ) {
          return new InvalidIndexOptionsError({
            collection: collection.toString(),
            message: cause.message,
          });
        }
        return new DatabaseError({ cause, message: "Failed to create index" });
      },
    }),
  );
}

/**
 * Drop collection index.
 */
export function dropIndex(
  ctx: AppBindings,
  collection: UUID,
  name: string,
): E.Effect<
  Document,
  CollectionNotFoundError | IndexNotFoundError | DatabaseError
> {
  return pipe(
    checkCollectionExists(ctx, "data", collection.toString()),
    E.tryMapPromise({
      try: (collection) => collection.dropIndex(name),
      catch: (cause) => {
        if (
          isMongoError(cause) &&
          cause.code === MongoErrorCode.IndexNotFound
        ) {
          return new IndexNotFoundError({
            collection: collection.toString(),
            index: name,
          });
        }
        return new DatabaseError({ cause, message: "Failed to drop index" });
      },
    }),
  );
}
