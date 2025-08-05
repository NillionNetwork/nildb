import { Effect as E, pipe } from "effect";
import {
  type DeleteResult,
  type Document,
  type StrictFilter,
  type UpdateResult,
  UUID,
} from "mongodb";
import {
  type Filter,
  MongoBulkWriteError,
  type UpdateFilter,
} from "mongodb/lib/beta";
import type { JsonObject } from "type-fest";
import type { CollectionDocument } from "#/collections/collections.types";
import {
  type CollectionNotFoundError,
  DatabaseError,
  type DataValidationError,
  DocumentNotFoundError,
  InvalidIndexOptionsError,
} from "#/common/errors";
import {
  addDocumentBaseCoercions,
  applyCoercions,
  CollectionName,
  checkCollectionExists,
  type DocumentBase,
  isMongoError,
  MongoErrorCode,
} from "#/common/mongo";
import type { UuidDto } from "#/common/types";
import type { AppBindings } from "#/env";
import type { QueryDocument } from "#/queries/queries.types";
import type { Acl } from "#/users/users.types";
import type {
  CreateFailure,
  OwnedDocumentBase,
  PartialDataDocumentDto,
  StandardDocumentBase,
  UploadResult,
} from "./data.types";

/**
 * Create data collection.
 */
export function createCollection(
  ctx: AppBindings,
  id: UUID,
): E.Effect<void, InvalidIndexOptionsError | DatabaseError> {
  return pipe(
    E.tryPromise({
      try: () => ctx.db.data.createCollection(id.toString()),
      catch: (cause) =>
        new DatabaseError({ cause, message: "createCollection" }),
    }),
    E.flatMap((collection) =>
      E.all([
        E.tryPromise({
          try: () =>
            collection.createIndex(
              { _updated: 1 },
              { unique: false, name: "_updated_1" },
            ),
          catch: (cause) => {
            if (
              isMongoError(cause) &&
              cause.code === MongoErrorCode.IndexNotFound
            ) {
              return new InvalidIndexOptionsError({
                collection: collection.toString(),
                message: "_updated_1",
              });
            }
            return new DatabaseError({ cause, message: "" });
          },
        }),
        E.tryPromise({
          try: () =>
            collection.createIndex(
              { _created: 1 },
              { unique: false, name: "_created_1" },
            ),
          catch: (cause) => {
            if (
              isMongoError(cause) &&
              cause.code === MongoErrorCode.IndexNotFound
            ) {
              return new InvalidIndexOptionsError({
                collection: collection.toString(),
                message: "_created_1",
              });
            }
            return new DatabaseError({ cause, message: "" });
          },
        }),
      ]),
    ),
    E.as(void 0),
  );
}

/**
 * Tail collection data.
 */
export function tailCollection(
  ctx: AppBindings,
  collection: UUID,
  limit: number,
): E.Effect<DocumentBase[], CollectionNotFoundError | DatabaseError> {
  return pipe(
    checkCollectionExists<DocumentBase>(ctx, "data", collection.toString()),
    E.tryMapPromise({
      try: (collection) =>
        collection.find().sort({ _created: -1 }).limit(limit).toArray(),
      catch: (cause) => new DatabaseError({ cause, message: "tailCollection" }),
    }),
  );
}

/**
 * Drop data collection.
 */
export function drop(
  ctx: AppBindings,
  collection: UUID,
): E.Effect<void, CollectionNotFoundError | DatabaseError> {
  return pipe(
    checkCollectionExists<DocumentBase>(ctx, "data", collection.toString()),
    E.tryMapPromise({
      try: (collection) =>
        ctx.db.data.dropCollection(collection.collectionName),
      catch: (cause) =>
        new DatabaseError({ cause, message: "deleteCollection" }),
    }),
    E.as(void 0),
  );
}

/**
 * Flush collection data.
 */
export function flushCollection(
  ctx: AppBindings,
  collection: UUID,
): E.Effect<DeleteResult, CollectionNotFoundError | DatabaseError> {
  return pipe(
    checkCollectionExists<DocumentBase>(ctx, "data", collection.toString()),
    E.tryMapPromise({
      try: (collection) => collection.deleteMany(),
      catch: (cause) =>
        new DatabaseError({ cause, message: "flushCollection" }),
    }),
  );
}

/**
 * Insert owned data.
 */
export function insertOwnedData(
  ctx: AppBindings,
  collection: CollectionDocument,
  data: PartialDataDocumentDto[],
  owner: string,
  acl: Acl[],
): E.Effect<UploadResult, CollectionNotFoundError | DatabaseError> {
  return pipe(
    checkCollectionExists<OwnedDocumentBase>(
      ctx,
      "data",
      collection._id.toString(),
    ),
    E.tryMapPromise({
      try: async (dataCollection) => {
        const created = new Set<UuidDto>();
        const errors: CreateFailure[] = [];

        const batchSize = 1000;
        const batches: OwnedDocumentBase[][] = [];
        const now = new Date();

        for (let i = 0; i < data.length; i += batchSize) {
          const batch: OwnedDocumentBase[] = data
            .slice(i, i + batchSize)
            .map((partial) => ({
              ...partial,
              _id: new UUID(partial._id),
              _created: now,
              _updated: now,
              _owner: owner,
              _acl: acl,
            }));
          batches.push(batch);
        }

        // Insert each batch of documents into the collection
        for (const batch of batches) {
          try {
            const result = await dataCollection.insertMany(batch, {
              ordered: false,
            });
            for (const id of Object.values(result.insertedIds)) {
              created.add(id.toString() as UuidDto);
            }
          } catch (e) {
            if (e instanceof MongoBulkWriteError) {
              const result = e.result;

              for (const id of Object.values(result.insertedIds)) {
                created.add(id.toString() as UuidDto);
              }

              result.getWriteErrors().map((writeError) => {
                const document = batch[writeError.index];
                created.delete(document._id.toString() as UuidDto);
                errors.push({
                  error: writeError.errmsg ?? "Unknown bulk operation error",
                  document,
                });
              });
            } else {
              console.error("An unhandled error occurred: %O", e);
              throw e;
            }
          }
        }

        return {
          created: Array.from(created),
          errors,
        };
      },
      catch: (cause) => new DatabaseError({ cause, message: "" }),
    }),
  );
}
/**
 * Insert standard data.
 */
export function insertStandardData(
  ctx: AppBindings,
  collection: CollectionDocument,
  data: PartialDataDocumentDto[],
): E.Effect<UploadResult, CollectionNotFoundError | DatabaseError> {
  return pipe(
    checkCollectionExists<StandardDocumentBase>(
      ctx,
      "data",
      collection._id.toString(),
    ),
    E.tryMapPromise({
      try: async (dataCollection) => {
        const created = new Set<UuidDto>();
        const errors: CreateFailure[] = [];

        const batchSize = 1000;
        const batches: StandardDocumentBase[][] = [];
        const now = new Date();

        for (let i = 0; i < data.length; i += batchSize) {
          const batch: DocumentBase[] = data
            .slice(i, i + batchSize)
            .map((partial) => ({
              ...partial,
              _id: new UUID(partial._id),
              _created: now,
              _updated: now,
            }));
          batches.push(batch);
        }

        // Insert each batch of documents into the collection
        for (const batch of batches) {
          try {
            const result = await dataCollection.insertMany(batch, {
              ordered: false,
            });
            for (const id of Object.values(result.insertedIds)) {
              created.add(id.toString() as UuidDto);
            }
          } catch (e) {
            if (e instanceof MongoBulkWriteError) {
              const result = e.result;

              for (const id of Object.values(result.insertedIds)) {
                created.add(id.toString() as UuidDto);
              }

              result.getWriteErrors().map((writeError) => {
                const document = batch[writeError.index];
                created.delete(document._id.toString() as UuidDto);
                errors.push({
                  error: writeError.errmsg ?? "Unknown bulk operation error",
                  document,
                });
              });
            } else {
              console.error("An unhandled error occurred: %O", e);
              throw e;
            }
          }
        }

        return {
          created: Array.from(created),
          errors,
        };
      },
      catch: (cause) => new DatabaseError({ cause, message: "" }),
    }),
  );
}

/**
 * Update multiple records.
 */
export function updateMany(
  ctx: AppBindings,
  collection: UUID,
  filter: Filter<DocumentBase>,
  update: UpdateFilter<DocumentBase>,
): E.Effect<
  UpdateResult,
  CollectionNotFoundError | DatabaseError | DataValidationError
> {
  return pipe(
    E.all([
      checkCollectionExists<DocumentBase>(ctx, "data", collection.toString()),
      applyCoercions<Filter<DocumentBase>>(addDocumentBaseCoercions(filter)),
      applyCoercions<UpdateFilter<DocumentBase>>(
        addDocumentBaseCoercions(update),
      ),
    ]),
    E.tryMapPromise({
      try: ([collection, documentFilter, documentUpdate]) =>
        collection.updateMany(documentFilter, documentUpdate),
      catch: (cause) => new DatabaseError({ cause, message: "updateMany" }),
    }),
  );
}

/**
 * Delete multiple records.
 */
export function deleteMany(
  ctx: AppBindings,
  collection: UUID,
  filter: StrictFilter<DocumentBase>,
): E.Effect<
  DeleteResult,
  CollectionNotFoundError | DatabaseError | DataValidationError
> {
  return pipe(
    E.all([
      checkCollectionExists<DocumentBase>(ctx, "data", collection.toString()),
      applyCoercions<Filter<DocumentBase>>(addDocumentBaseCoercions(filter)),
    ]),
    E.tryMapPromise({
      try: ([collection, documentFilter]) =>
        collection.deleteMany(documentFilter),
      catch: (cause) => new DatabaseError({ cause, message: "deleteMany" }),
    }),
  );
}

/**
 * Run aggregation query.
 */
export function runAggregation(
  ctx: AppBindings,
  query: QueryDocument,
  pipeline: Document[],
): E.Effect<JsonObject[], CollectionNotFoundError | DatabaseError> {
  return pipe(
    checkCollectionExists<DocumentBase>(
      ctx,
      "data",
      query.collection.toString(),
    ),
    E.tryMapPromise({
      try: (collection) => collection.aggregate(pipeline).toArray(),
      catch: (cause) => new DatabaseError({ cause, message: "runAggregation" }),
    }),
  );
}

/**
 * Find multiple records.
 */
export function findMany(
  ctx: AppBindings,
  collection: UUID,
  filter: Filter<DocumentBase>,
): E.Effect<
  DocumentBase[],
  CollectionNotFoundError | DatabaseError | DataValidationError
> {
  return pipe(
    E.all([
      checkCollectionExists<DocumentBase>(ctx, "data", collection.toString()),
      applyCoercions<Filter<DocumentBase>>(addDocumentBaseCoercions(filter)),
    ]),
    E.tryMapPromise({
      try: ([collection, documentFilter]) =>
        collection.find(documentFilter).sort({ _created: -1 }).toArray(),
      catch: (cause) => new DatabaseError({ cause, message: "findMany" }),
    }),
  );
}

/**
 * Find one record.
 */
export function findOne(
  ctx: AppBindings,
  collection: UUID,
  filter: Filter<DocumentBase>,
): E.Effect<
  DocumentBase,
  | DocumentNotFoundError
  | CollectionNotFoundError
  | DatabaseError
  | DataValidationError
> {
  return pipe(
    E.all([
      checkCollectionExists<DocumentBase>(ctx, "data", collection.toString()),
      applyCoercions<Filter<DocumentBase>>(addDocumentBaseCoercions(filter)),
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
