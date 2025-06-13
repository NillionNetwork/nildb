import { Effect as E, pipe } from "effect";
import type {
  CreateIndexesOptions,
  Document,
  IndexSpecification,
  StrictFilter,
  UUID,
} from "mongodb";
import type { Filter } from "mongodb/lib/beta";
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
  addDocumentBaseCoercions,
  applyCoercions,
  CollectionName,
  checkCollectionExists,
  isMongoError,
  MongoErrorCode,
} from "#/common/mongo";
import type { CoercibleMap } from "#/common/types";
import type { AppBindings } from "#/env";

/**
 * Add collection document coercions.
 */
export function addCollectionDocumentCoercions(
  coercibleMap: CoercibleMap,
): CoercibleMap {
  return addDocumentBaseCoercions(coercibleMap);
}

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
): E.Effect<
  CollectionDocument[],
  CollectionNotFoundError | DatabaseError | DataValidationError
> {
  return pipe(
    E.all([
      checkCollectionExists<CollectionDocument>(
        ctx,
        "primary",
        CollectionName.Collections,
      ),
      applyCoercions<Filter<CollectionDocument>>(
        addCollectionDocumentCoercions(filter),
      ),
    ]),
    E.tryMapPromise({
      try: ([collection, documentFilter]) =>
        collection.find(documentFilter).toArray(),
      catch: (cause) => new DatabaseError({ cause, message: "findMany" }),
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
    E.all([
      checkCollectionExists<CollectionDocument>(
        ctx,
        "primary",
        CollectionName.Collections,
      ),
      applyCoercions<Filter<CollectionDocument>>(
        addCollectionDocumentCoercions(filter),
      ),
    ]),
    E.tryMapPromise({
      try: ([collection, documentFilter]) => collection.findOne(documentFilter),
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
    E.all([
      checkCollectionExists<CollectionDocument>(
        ctx,
        "primary",
        CollectionName.Collections,
      ),
      applyCoercions<Filter<CollectionDocument>>(
        addCollectionDocumentCoercions(filter),
      ),
    ]),
    E.tryMapPromise({
      try: ([collection, documentFilter]) =>
        collection.findOneAndDelete(documentFilter),
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
 * Get collection statistics.
 */
export function getCollectionStats(
  ctx: AppBindings,
  id: UUID,
): E.Effect<CollectionMetadata, CollectionNotFoundError | DatabaseError> {
  return pipe(
    checkCollectionExists(ctx, "data", id.toString()),
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
        id,
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
    checkCollectionExists(ctx, "primary", collection.toString()),
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
        return new DatabaseError({ cause, message: "Failed to drop index" });
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
    checkCollectionExists(ctx, "primary", collection.toString()),
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
