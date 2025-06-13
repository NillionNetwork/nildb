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
  InvalidIndexOptionsError,
} from "#/common/errors";
import {
  addDocumentBaseCoercions,
  applyCoercions,
  checkCollectionExists,
  type DocumentBase,
  isMongoError,
  MongoErrorCode,
} from "#/common/mongo";
import type { Did, UuidDto } from "#/common/types";
import type { AppBindings } from "#/env";
import type { QueryDocument } from "#/queries/queries.types";
import type { Acl } from "#/users/users.types";
import type {
  CreateFailure,
  PartialDataDocumentDto,
  UploadResult,
} from "./data.types";

/**
 * Create data collection.
 */
export function createCollection(
  ctx: AppBindings,
  schemaId: UUID,
): E.Effect<void, InvalidIndexOptionsError | DatabaseError> {
  return pipe(
    E.tryPromise({
      try: () => ctx.db.data.createCollection(schemaId.toString()),
      catch: (cause) => new DatabaseError({ cause, message: "" }),
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
                collection: schemaId.toString(),
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
                collection: schemaId.toString(),
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
  schema: UUID,
  limit: number,
): E.Effect<DocumentBase[], CollectionNotFoundError | DatabaseError> {
  return pipe(
    checkCollectionExists<DocumentBase>(ctx, "data", schema.toString()),
    E.tryMapPromise({
      try: (collection) =>
        collection.find().sort({ _created: -1 }).limit(limit).toArray(),
      catch: (cause) => new DatabaseError({ cause, message: "tailCollection" }),
    }),
  );
}

/**
 * Delete data collection.
 */
export function deleteCollection(
  ctx: AppBindings,
  schema: UUID,
): E.Effect<void, CollectionNotFoundError | DatabaseError> {
  return pipe(
    checkCollectionExists<DocumentBase>(ctx, "data", schema.toString()),
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
  schema: UUID,
): E.Effect<DeleteResult, CollectionNotFoundError | DatabaseError> {
  return pipe(
    checkCollectionExists<DocumentBase>(ctx, "data", schema.toString()),
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
  schema: CollectionDocument,
  data: PartialDataDocumentDto[],
  owner: Did,
  acl: Acl[],
): E.Effect<UploadResult, CollectionNotFoundError | DatabaseError> {
  return pipe(
    checkCollectionExists<DocumentBase>(ctx, "data", schema._id.toString()),
    E.tryMapPromise({
      try: async (collection) => {
        const created = new Set<UuidDto>();
        const errors: CreateFailure[] = [];

        const batchSize = 1000;
        const batches: DocumentBase[][] = [];
        const now = new Date();

        for (let i = 0; i < data.length; i += batchSize) {
          const batch: DocumentBase[] = data
            .slice(i, i + batchSize)
            .map((partial) => ({
              ...partial,
              _id: new UUID(partial._id),
              _created: now,
              _updated: now,
              _owner: owner,
              _perms: acl,
              documentType: schema.type,
            }));
          batches.push(batch);
        }

        // Insert each batch of documents into the collection
        for (const batch of batches) {
          try {
            const result = await collection.insertMany(batch, {
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
  schema: CollectionDocument,
  data: PartialDataDocumentDto[],
): E.Effect<UploadResult, CollectionNotFoundError | DatabaseError> {
  return pipe(
    checkCollectionExists<DocumentBase>(ctx, "data", schema._id.toString()),
    E.tryMapPromise({
      try: async (collection) => {
        const created = new Set<UuidDto>();
        const errors: CreateFailure[] = [];

        const batchSize = 1000;
        const batches: DocumentBase[][] = [];
        const now = new Date();

        for (let i = 0; i < data.length; i += batchSize) {
          const batch: DocumentBase[] = data
            .slice(i, i + batchSize)
            .map((partial) => ({
              ...partial,
              _id: new UUID(partial._id),
              _created: now,
              _updated: now,
              documentType: schema.type,
            }));
          batches.push(batch);
        }

        // Insert each batch of documents into the collection
        for (const batch of batches) {
          try {
            const result = await collection.insertMany(batch, {
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
  schema: UUID,
  filter: Filter<DocumentBase>,
  update: UpdateFilter<DocumentBase>,
): E.Effect<
  UpdateResult,
  CollectionNotFoundError | DatabaseError | DataValidationError
> {
  return pipe(
    E.all([
      checkCollectionExists<DocumentBase>(ctx, "data", schema.toString()),
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
  schema: UUID,
  filter: StrictFilter<DocumentBase>,
): E.Effect<
  DeleteResult,
  CollectionNotFoundError | DatabaseError | DataValidationError
> {
  return pipe(
    E.all([
      checkCollectionExists<DocumentBase>(ctx, "data", schema.toString()),
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
    checkCollectionExists<DocumentBase>(ctx, "data", query.schema.toString()),
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
  schema: UUID,
  filter: Filter<DocumentBase>,
): E.Effect<
  DocumentBase[],
  CollectionNotFoundError | DatabaseError | DataValidationError
> {
  return pipe(
    E.all([
      checkCollectionExists<DocumentBase>(ctx, "data", schema.toString()),
      applyCoercions<Filter<DocumentBase>>(addDocumentBaseCoercions(filter)),
    ]),
    E.tryMapPromise({
      try: ([collection, documentFilter]) =>
        collection.find(documentFilter).sort({ _created: -1 }).toArray(),
      catch: (cause) => new DatabaseError({ cause, message: "findMany" }),
    }),
  );
}
