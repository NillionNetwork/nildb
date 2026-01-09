import {
  type CollectionNotFoundError,
  DatabaseError,
  DocumentNotFoundError,
  DuplicateEntryError,
} from "@nildb/common/errors";
import { CollectionName, checkCollectionExists, MongoErrorCode } from "@nildb/common/mongo";
import type { AppBindings } from "@nildb/env";
import { Effect as E, pipe } from "effect";
import { MongoServerError, type StrictFilter, type StrictUpdateFilter, type UpdateResult, type UUID } from "mongodb";

import type { BuilderDocument } from "./builders.types.js";

/**
 * Insert builder document.
 */
export function insert(
  ctx: AppBindings,
  document: BuilderDocument,
): E.Effect<void, DuplicateEntryError | CollectionNotFoundError | DatabaseError> {
  return pipe(
    checkCollectionExists<BuilderDocument>(ctx, "primary", CollectionName.Builders),
    E.tryMapPromise({
      try: (collection) => collection.insertOne(document),
      catch: (cause) => {
        if (cause instanceof MongoServerError && cause.code === MongoErrorCode.Duplicate) {
          return new DuplicateEntryError({
            document: {
              did: document.did,
            },
          });
        }
        return new DatabaseError({ cause, message: "insert" });
      },
    }),
    E.as(void 0),
  );
}

/**
 * Find builder by ID with cache.
 */
export function findByIdWithCache(
  ctx: AppBindings,
  builder: string,
): E.Effect<BuilderDocument, DocumentNotFoundError | CollectionNotFoundError | DatabaseError> {
  const cache = ctx.cache.builders;
  const document = cache.get(builder);
  if (document) {
    return E.succeed(document);
  }

  const filter = { did: builder };

  return pipe(
    checkCollectionExists<BuilderDocument>(ctx, "primary", CollectionName.Builders),
    E.tryMapPromise({
      try: (collection) => collection.findOne(filter),
      catch: (cause) => new DatabaseError({ cause, message: "findByIdWithCache" }),
    }),
    E.flatMap((result) =>
      result === null
        ? E.fail(
            new DocumentNotFoundError({
              collection: CollectionName.Builders,
              filter,
            }),
          )
        : E.succeed(result),
    ),
    E.tap((document) => cache.set(builder, document)),
  );
}

/**
 * Find builder by ID.
 */
export function findOne(
  ctx: AppBindings,
  builder: string,
): E.Effect<BuilderDocument, DocumentNotFoundError | CollectionNotFoundError | DatabaseError> {
  const filter: StrictFilter<BuilderDocument> = { did: builder };

  return pipe(
    checkCollectionExists<BuilderDocument>(ctx, "primary", CollectionName.Builders),
    E.tryMapPromise({
      try: (collection) => collection.findOne(filter),
      catch: (cause) => new DatabaseError({ cause, message: "findOne" }),
    }),
    E.flatMap((result) =>
      result === null
        ? E.fail(
            new DocumentNotFoundError({
              collection: CollectionName.Builders,
              filter,
            }),
          )
        : E.succeed(result),
    ),
  );
}

/**
 * Delete builder by ID.
 */
export function deleteOneById(
  ctx: AppBindings,
  builder: string,
): E.Effect<void, DocumentNotFoundError | CollectionNotFoundError | DatabaseError> {
  const filter: StrictFilter<BuilderDocument> = { did: builder };

  return pipe(
    checkCollectionExists<BuilderDocument>(ctx, "primary", CollectionName.Builders),
    E.tryMapPromise({
      try: (collection) => collection.deleteOne(filter),
      catch: (cause) => new DatabaseError({ cause, message: "deleteOneById" }),
    }),
    E.flatMap((result) =>
      result === null
        ? E.fail(
            new DocumentNotFoundError({
              collection: CollectionName.Builders,
              filter,
            }),
          )
        : E.succeed(result),
    ),
    E.tap(() => ctx.cache.builders.delete(builder)),
  );
}

/**
 * Update builder fields.
 */
export function update(
  ctx: AppBindings,
  builder: string,
  updates: Partial<{ _updated: Date; name: string }>,
): E.Effect<UpdateResult, DocumentNotFoundError | CollectionNotFoundError | DatabaseError> {
  const filter: StrictFilter<BuilderDocument> = { did: builder };

  const update: StrictUpdateFilter<BuilderDocument> = {
    $set: {
      ...(updates._updated && { _updated: updates._updated }),
      ...(updates.name && { name: updates.name }),
    },
  };

  return pipe(
    checkCollectionExists<BuilderDocument>(ctx, "primary", CollectionName.Builders),
    E.tryMapPromise({
      try: (collection) => collection.updateOne(filter, update),
      catch: (cause) => new DatabaseError({ cause, message: "setPublicKey" }),
    }),
    E.flatMap((result) =>
      result === null
        ? E.fail(
            new DocumentNotFoundError({
              collection: CollectionName.Builders,
              filter,
            }),
          )
        : E.succeed(result),
    ),
  );
}

/**
 * Add collection to builder.
 */
export function addCollection(
  ctx: AppBindings,
  builder: string,
  collection: UUID,
): E.Effect<void, DocumentNotFoundError | CollectionNotFoundError | DatabaseError> {
  const filter: StrictFilter<BuilderDocument> = { did: builder };

  const update: StrictUpdateFilter<BuilderDocument> = {
    $addToSet: { collections: collection },
  };

  return pipe(
    checkCollectionExists<BuilderDocument>(ctx, "primary", CollectionName.Builders),
    E.tryMapPromise({
      try: (collection) => collection.updateOne(filter, update),
      catch: (cause) => new DatabaseError({ cause, message: "addCollection" }),
    }),
    E.flatMap((result) =>
      result.modifiedCount === 1
        ? E.succeed(void 0)
        : E.fail(
            new DocumentNotFoundError({
              collection: CollectionName.Builders,
              filter,
            }),
          ),
    ),
  );
}

/**
 * Remove collection from builder.
 */
export function removeCollection(
  ctx: AppBindings,
  builder: string,
  collection: UUID,
): E.Effect<void, DocumentNotFoundError | CollectionNotFoundError | DatabaseError> {
  const filter: StrictFilter<BuilderDocument> = { did: builder };

  const update: StrictUpdateFilter<BuilderDocument> = {
    $pull: { collections: collection },
  };

  return pipe(
    checkCollectionExists<BuilderDocument>(ctx, "primary", CollectionName.Builders),
    E.tryMapPromise({
      try: (collection) => collection.updateOne(filter, update),
      catch: (cause) => new DatabaseError({ cause, message: "removeCollection" }),
    }),
    E.flatMap((result) =>
      result.modifiedCount === 1
        ? E.succeed(void 0)
        : E.fail(
            new DocumentNotFoundError({
              collection: CollectionName.Builders,
              filter,
            }),
          ),
    ),
  );
}

/**
 * Add query to builder.
 */
export function addQuery(
  ctx: AppBindings,
  builder: string,
  query: UUID,
): E.Effect<void, DocumentNotFoundError | CollectionNotFoundError | DatabaseError> {
  const filter: StrictFilter<BuilderDocument> = { did: builder };
  const update: StrictUpdateFilter<BuilderDocument> = {
    $addToSet: { queries: query },
  };

  return pipe(
    checkCollectionExists<BuilderDocument>(ctx, "primary", CollectionName.Builders),
    E.tryMapPromise({
      try: (collection) => collection.updateOne(filter, update),
      catch: (cause) => new DatabaseError({ cause, message: "addQuery" }),
    }),
    E.flatMap((result) =>
      result.modifiedCount === 1
        ? E.succeed(void 0)
        : E.fail(
            new DocumentNotFoundError({
              collection: CollectionName.Builders,
              filter,
            }),
          ),
    ),
  );
}

/**
 * Remove query from builder.
 */
export function removeQuery(
  ctx: AppBindings,
  builder: string,
  query: UUID,
): E.Effect<void, DocumentNotFoundError | CollectionNotFoundError | DatabaseError> {
  const filter: StrictFilter<BuilderDocument> = { did: builder };

  const update: StrictUpdateFilter<BuilderDocument> = {
    $pull: { queries: query },
  };

  return pipe(
    checkCollectionExists<BuilderDocument>(ctx, "primary", CollectionName.Builders),
    E.tryMapPromise({
      try: (collection) => collection.updateOne(filter, update),
      catch: (cause) => new DatabaseError({ cause, message: "removeQuery" }),
    }),
    E.flatMap((result) =>
      result.modifiedCount === 1
        ? E.succeed(void 0)
        : E.fail(
            new DocumentNotFoundError({
              collection: CollectionName.Builders,
              filter,
            }),
          ),
    ),
  );
}
