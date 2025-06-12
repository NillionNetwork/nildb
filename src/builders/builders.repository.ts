import { Effect as E, pipe } from "effect";
import type {
  StrictFilter,
  StrictUpdateFilter,
  UpdateResult,
  UUID,
} from "mongodb";
import {
  type CollectionNotFoundError,
  DatabaseError,
  DocumentNotFoundError,
} from "#/common/errors";
import { CollectionName, checkCollectionExists } from "#/common/mongo";
import type { Did } from "#/common/types";
import type { AppBindings } from "#/env";
import type { BuilderDocument } from "./builders.types";

/**
 * Inserts a new organisation builder document into the database.
 *
 * @param ctx - Application context containing database connections
 * @param document - Complete builder document to insert
 * @returns Effect indicating success or database errors
 */
export function insert(
  ctx: AppBindings,
  document: BuilderDocument,
): E.Effect<void, CollectionNotFoundError | DatabaseError> {
  return pipe(
    checkCollectionExists<BuilderDocument>(
      ctx,
      "primary",
      CollectionName.Builders,
    ),
    E.tryMapPromise({
      try: (collection) => collection.insertOne(document),
      catch: (cause) => new DatabaseError({ cause, message: "insert" }),
    }),
    E.as(void 0),
  );
}

/**
 * Retrieves any builder type by DID with caching.
 *
 * Checks the cache first, falls back to database if not found.
 * Caches the result for subsequent requests.
 *
 * @param ctx - Application context containing database connections and cache
 * @param _id - DID of the builder to retrieve
 * @returns Effect containing the builder document or relevant errors
 */
export function findByIdWithCache(
  ctx: AppBindings,
  _id: Did,
): E.Effect<
  BuilderDocument,
  DocumentNotFoundError | CollectionNotFoundError | DatabaseError
> {
  const cache = ctx.cache.builders;
  const builder = cache.get(_id);
  if (builder) {
    return E.succeed(builder);
  }

  const filter = { _id };

  return pipe(
    checkCollectionExists<BuilderDocument>(
      ctx,
      "primary",
      CollectionName.Builders,
    ),
    E.tryMapPromise({
      try: (collection) => collection.findOne(filter),
      catch: (cause) =>
        new DatabaseError({ cause, message: "findByIdWithCache" }),
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
    E.tap((document) => cache.set(_id, document)),
  );
}

/**
 * Retrieves an organisation builder by DID.
 *
 * Filters by both DID and organisation role to ensure
 * only organisation builders are returned.
 *
 * @param ctx - Application context containing database connections
 * @param _id - DID of the organisation to retrieve
 * @returns Effect containing the organisation document or relevant errors
 */
export function findOne(
  ctx: AppBindings,
  _id: Did,
): E.Effect<
  BuilderDocument,
  DocumentNotFoundError | CollectionNotFoundError | DatabaseError
> {
  const filter: StrictFilter<BuilderDocument> = {
    id: _id,
  };
  return pipe(
    checkCollectionExists<BuilderDocument>(
      ctx,
      "primary",
      CollectionName.Builders,
    ),
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
 * Deletes an organisation builder by DID.
 *
 * Removes the builder from the database and invalidates
 * any cached entries for this DID.
 *
 * @param ctx - Application context containing database connections and cache
 * @param _id - DID of the organisation to delete
 * @returns Effect indicating success or relevant errors
 */
export function deleteOneById(
  ctx: AppBindings,
  _id: Did,
): E.Effect<
  void,
  DocumentNotFoundError | CollectionNotFoundError | DatabaseError
> {
  const filter: StrictFilter<BuilderDocument> = {
    id: _id,
  };

  return pipe(
    checkCollectionExists<BuilderDocument>(
      ctx,
      "primary",
      CollectionName.Builders,
    ),
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
    E.tap(() => ctx.cache.builders.delete(_id)),
  );
}

/**
 * Updates an organisation builder's fields.
 *
 * Performs a partial update of allowed fields using MongoDB's
 * $set operator. Currently supports updating name only.
 *
 * @param ctx - Application context containing database connections
 * @param _id - DID of the organisation to update
 * @param updates - Partial object containing fields to update
 * @returns Effect containing update result or relevant errors
 */
export function update(
  ctx: AppBindings,
  _id: Did,
  updates: Partial<{ _id: Did; _updated: Date; name: string }>,
): E.Effect<
  UpdateResult,
  DocumentNotFoundError | CollectionNotFoundError | DatabaseError
> {
  const filter: StrictFilter<BuilderDocument> = {
    id: _id,
  };
  const update: StrictUpdateFilter<BuilderDocument> = {
    $set: {
      ...(updates._id && { id: updates._id }),
      ...(updates._updated && { _updated: updates._updated }),
      ...(updates.name && { name: updates.name }),
    },
  };

  return pipe(
    checkCollectionExists<BuilderDocument>(
      ctx,
      "primary",
      CollectionName.Builders,
    ),
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

export function addCollection(
  ctx: AppBindings,
  owner: Did,
  id: UUID,
): E.Effect<
  void,
  DocumentNotFoundError | CollectionNotFoundError | DatabaseError
> {
  const filter: StrictFilter<BuilderDocument> = { id: owner };
  const update: StrictUpdateFilter<BuilderDocument> = {
    $addToSet: { collections: id },
  };

  return pipe(
    checkCollectionExists<BuilderDocument>(
      ctx,
      "primary",
      CollectionName.Builders,
    ),
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

export function removeCollection(
  ctx: AppBindings,
  owner: Did,
  id: UUID,
): E.Effect<
  void,
  DocumentNotFoundError | CollectionNotFoundError | DatabaseError
> {
  const filter: StrictFilter<BuilderDocument> = { id: owner };

  const update: StrictUpdateFilter<BuilderDocument> = {
    $pull: { collections: id },
  };

  return pipe(
    checkCollectionExists<BuilderDocument>(
      ctx,
      "primary",
      CollectionName.Builders,
    ),
    E.tryMapPromise({
      try: (collection) => collection.updateOne(filter, update),
      catch: (cause) =>
        new DatabaseError({ cause, message: "removeCollection" }),
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

export function addQuery(
  ctx: AppBindings,
  orgId: Did,
  queryId: UUID,
): E.Effect<
  void,
  DocumentNotFoundError | CollectionNotFoundError | DatabaseError
> {
  const filter: StrictFilter<BuilderDocument> = { id: orgId };
  const update: StrictUpdateFilter<BuilderDocument> = {
    $addToSet: { queries: queryId },
  };

  return pipe(
    checkCollectionExists<BuilderDocument>(
      ctx,
      "primary",
      CollectionName.Builders,
    ),
    E.tryMapPromise({
      try: (collection) => collection.updateOne(filter, update),
      catch: (cause) => new DatabaseError({ cause, message: "" }),
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

export function removeQuery(
  ctx: AppBindings,
  orgId: Did,
  queryId: UUID,
): E.Effect<
  void,
  DocumentNotFoundError | CollectionNotFoundError | DatabaseError
> {
  const filter: StrictFilter<BuilderDocument> = { id: orgId };
  const update: StrictUpdateFilter<BuilderDocument> = {
    $pull: { queries: queryId },
  };

  return pipe(
    checkCollectionExists<BuilderDocument>(
      ctx,
      "primary",
      CollectionName.Builders,
    ),
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
