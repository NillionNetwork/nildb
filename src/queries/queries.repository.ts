import { Effect as E, pipe } from "effect";
import type { DeleteResult, StrictFilter } from "mongodb";
import { applyCoercions } from "#/common/coercion";
import {
  type CollectionNotFoundError,
  DatabaseError,
  type DataValidationError,
  DocumentNotFoundError,
} from "#/common/errors";
import {
  addDocumentBaseCoercions,
  CollectionName,
  checkCollectionExists,
} from "#/common/mongo";
import type { AppBindings } from "#/env";
import type { QueryDocument } from "./queries.types";

/**
 * Insert query document.
 */
export function insert(
  ctx: AppBindings,
  document: QueryDocument,
): E.Effect<void, CollectionNotFoundError | DatabaseError> {
  return pipe(
    checkCollectionExists<QueryDocument>(
      ctx,
      "primary",
      CollectionName.Queries,
    ),
    E.tryMapPromise({
      try: (collection) => collection.insertOne(document),
      catch: (cause) => new DatabaseError({ cause, message: "insert" }),
    }),
    E.as(void 0),
  );
}

/**
 * Find multiple queries.
 */
export function findMany(
  ctx: AppBindings,
  filter: StrictFilter<QueryDocument>,
): E.Effect<
  QueryDocument[],
  | DocumentNotFoundError
  | CollectionNotFoundError
  | DatabaseError
  | DataValidationError
> {
  return pipe(
    E.all([
      checkCollectionExists<QueryDocument>(
        ctx,
        "primary",
        CollectionName.Queries,
      ),
      applyCoercions(addDocumentBaseCoercions(filter)),
    ]),
    E.tryMapPromise({
      try: ([collection, documentFilter]) =>
        collection.find(documentFilter).toArray(),
      catch: (cause) => new DatabaseError({ cause, message: "findMany" }),
    }),
    E.flatMap((result) =>
      result === null
        ? E.fail(
            new DocumentNotFoundError({
              collection: CollectionName.Queries,
              filter,
            }),
          )
        : E.succeed(result),
    ),
  );
}

/**
 * Find query by filter.
 */
export function findOne(
  ctx: AppBindings,
  filter: StrictFilter<QueryDocument>,
): E.Effect<
  QueryDocument,
  | DocumentNotFoundError
  | CollectionNotFoundError
  | DatabaseError
  | DataValidationError
> {
  return pipe(
    E.Do,
    E.bind("collection", () =>
      checkCollectionExists<QueryDocument>(
        ctx,
        "primary",
        CollectionName.Queries,
      ),
    ),
    E.bind("filter", () => applyCoercions(addDocumentBaseCoercions(filter))),
    E.tryMapPromise({
      try: ({ collection, filter }) => collection.findOne(filter),
      catch: (cause) => new DatabaseError({ cause, message: "findOne" }),
    }),
    E.flatMap((result) =>
      result === null
        ? E.fail(
            new DocumentNotFoundError({
              collection: CollectionName.Queries,
              filter,
            }),
          )
        : E.succeed(result),
    ),
  );
}

/**
 * Find and delete query.
 */
export function findOneAndDelete(
  ctx: AppBindings,
  filter: StrictFilter<QueryDocument>,
): E.Effect<
  QueryDocument,
  | DocumentNotFoundError
  | CollectionNotFoundError
  | DatabaseError
  | DataValidationError
> {
  return pipe(
    E.all([
      checkCollectionExists<QueryDocument>(
        ctx,
        "primary",
        CollectionName.Queries,
      ),
      applyCoercions(addDocumentBaseCoercions(filter)),
    ]),
    E.tryMapPromise({
      try: ([collection, documentFilter]) =>
        collection.findOneAndDelete(documentFilter),
      catch: (cause) =>
        new DatabaseError({ cause, message: "findOneAndDelete" }),
    }),
    E.flatMap((result) =>
      result === null
        ? E.fail(
            new DocumentNotFoundError({
              collection: CollectionName.Queries,
              filter,
            }),
          )
        : E.succeed(result),
    ),
  );
}

/**
 * Delete many queries.
 */
export function deleteMany(
  ctx: AppBindings,
  filter: StrictFilter<QueryDocument>,
): E.Effect<
  DeleteResult,
  | DocumentNotFoundError
  | CollectionNotFoundError
  | DatabaseError
  | DataValidationError
> {
  return pipe(
    E.all([
      checkCollectionExists<QueryDocument>(
        ctx,
        "primary",
        CollectionName.Queries,
      ),
      applyCoercions(addDocumentBaseCoercions(filter)),
    ]),
    E.tryMapPromise({
      try: ([collection, documentFilter]) =>
        collection.deleteMany(documentFilter),
      catch: (cause) => new DatabaseError({ cause, message: "deleteMany" }),
    }),
    E.flatMap((result) =>
      result === null
        ? E.fail(
            new DocumentNotFoundError({
              collection: CollectionName.Queries,
              filter,
            }),
          )
        : E.succeed(result),
    ),
  );
}
