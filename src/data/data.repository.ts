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
import type { SchemaDocument } from "#/schemas/schemas.repository";
import type {
  PartialDataDocumentDto,
  Permissions,
  PermissionsDto,
} from "./data.types";

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

export const TAIL_DATA_LIMIT = 25;

export function tailCollection(
  ctx: AppBindings,
  schema: UUID,
): E.Effect<DataDocument[], CollectionNotFoundError | DatabaseError> {
  return pipe(
    checkCollectionExists<DataDocument>(ctx, "data", schema.toString()),
    E.tryMapPromise({
      try: (collection) =>
        collection
          .find()
          .sort({ _created: -1 })
          .limit(TAIL_DATA_LIMIT)
          .toArray(),
      catch: (cause) => new DatabaseError({ cause, message: "tailCollection" }),
    }),
  );
}

export function deleteCollection(
  ctx: AppBindings,
  schema: UUID,
): E.Effect<void, CollectionNotFoundError | DatabaseError> {
  return pipe(
    checkCollectionExists<DataDocument>(ctx, "data", schema.toString()),
    E.tryMapPromise({
      try: (collection) =>
        ctx.db.data.dropCollection(collection.collectionName),
      catch: (cause) =>
        new DatabaseError({ cause, message: "deleteCollection" }),
    }),
    E.as(void 0),
  );
}

export function flushCollection(
  ctx: AppBindings,
  schema: UUID,
): E.Effect<DeleteResult, CollectionNotFoundError | DatabaseError> {
  return pipe(
    checkCollectionExists<DataDocument>(ctx, "data", schema.toString()),
    E.tryMapPromise({
      try: (collection) => collection.deleteMany(),
      catch: (cause) =>
        new DatabaseError({ cause, message: "flushCollection" }),
    }),
  );
}

export type DataDocumentBase = DocumentBase<UUID> & {
  _owner: Did;
  _perms: PermissionsDto[];
};
export type DataDocument<
  T extends Record<string, unknown> = Record<string, unknown>,
> = DataDocumentBase & T;

export type CreateFailure = {
  error: string;
  document: unknown;
};

export type UploadResult = {
  created: UuidDto[];
  errors: CreateFailure[];
};

export function insert(
  ctx: AppBindings,
  schema: SchemaDocument,
  data: PartialDataDocumentDto[],
  owner: Did,
  perms: Permissions[],
): E.Effect<UploadResult, CollectionNotFoundError | DatabaseError> {
  return pipe(
    checkCollectionExists<DataDocument>(ctx, "data", schema._id.toString()),
    E.tryMapPromise({
      try: async (collection) => {
        const created = new Set<UuidDto>();
        const errors: CreateFailure[] = [];

        const batchSize = 1000;
        const batches: DataDocument[][] = [];
        const now = new Date();

        for (let i = 0; i < data.length; i += batchSize) {
          const batch: DataDocument[] = data
            .slice(i, i + batchSize)
            .map((partial) => ({
              ...partial,
              _id: new UUID(partial._id),
              _created: now,
              _updated: now,
              _owner: owner,
              _perms: perms.map((perm) => perm.toJSON()),
              documentType: schema.documentType,
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

export function updateMany(
  ctx: AppBindings,
  schema: UUID,
  filter: Filter<DataDocumentBase>,
  update: UpdateFilter<DataDocumentBase>,
): E.Effect<
  UpdateResult,
  CollectionNotFoundError | DatabaseError | DataValidationError
> {
  return pipe(
    E.all([
      checkCollectionExists<DataDocumentBase>(ctx, "data", schema.toString()),
      applyCoercions<Filter<DataDocumentBase>>(
        addDocumentBaseCoercions(filter),
      ),
      applyCoercions<UpdateFilter<DataDocumentBase>>(
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

export function deleteMany(
  ctx: AppBindings,
  schema: UUID,
  filter: StrictFilter<DataDocumentBase>,
): E.Effect<
  DeleteResult,
  CollectionNotFoundError | DatabaseError | DataValidationError
> {
  return pipe(
    E.all([
      checkCollectionExists<DataDocumentBase>(ctx, "data", schema.toString()),
      applyCoercions<Filter<DataDocumentBase>>(
        addDocumentBaseCoercions(filter),
      ),
    ]),
    E.tryMapPromise({
      try: ([collection, documentFilter]) =>
        collection.deleteMany(documentFilter),
      catch: (cause) => new DatabaseError({ cause, message: "deleteMany" }),
    }),
  );
}

export function runAggregation(
  ctx: AppBindings,
  query: QueryDocument,
  pipeline: Document[],
): E.Effect<JsonObject[], CollectionNotFoundError | DatabaseError> {
  return pipe(
    checkCollectionExists<DataDocumentBase>(
      ctx,
      "data",
      query.schema.toString(),
    ),
    E.tryMapPromise({
      try: (collection) => collection.aggregate(pipeline).toArray(),
      catch: (cause) => new DatabaseError({ cause, message: "runAggregation" }),
    }),
  );
}

export function findMany(
  ctx: AppBindings,
  schema: UUID,
  filter: Filter<DataDocumentBase>,
): E.Effect<
  DataDocument[],
  CollectionNotFoundError | DatabaseError | DataValidationError
> {
  return pipe(
    E.all([
      checkCollectionExists<DataDocumentBase>(ctx, "data", schema.toString()),
      applyCoercions<Filter<DataDocumentBase>>(
        addDocumentBaseCoercions(filter),
      ),
    ]),
    E.tryMapPromise({
      try: ([collection, documentFilter]) =>
        collection.find(documentFilter).sort({ _created: -1 }).toArray(),
      catch: (cause) => new DatabaseError({ cause, message: "findMany" }),
    }),
  );
}
