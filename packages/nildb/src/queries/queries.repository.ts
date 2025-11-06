import { applyCoercions } from "@nildb/common/coercion";
import {
  type CollectionNotFoundError,
  DatabaseError,
  type DataValidationError,
  DocumentNotFoundError,
} from "@nildb/common/errors";
import {
  addDocumentBaseCoercions,
  CollectionName,
  checkCollectionExists,
} from "@nildb/common/mongo";
import type { PaginationQuery } from "@nildb/common/pagination.dto";
import type { AppBindings } from "@nildb/env";
import { Effect as E, pipe } from "effect";
import type { DeleteResult, StrictFilter } from "mongodb";
import type { QueryDocument } from "./queries.types.js";

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
 * Finds multiple queries with pagination.
 *
 * @param ctx The application bindings.
 * @param filter The MongoDB filter to apply.
 * @param pagination The pagination parameters (limit and offset).
 * @returns A tuple containing an array of found query documents and the total count.
 */
export function findMany(
  ctx: AppBindings,
  filter: StrictFilter<QueryDocument>,
  pagination: PaginationQuery,
): E.Effect<
  [QueryDocument[], number],
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
    E.flatMap(([collection, documentFilter]) =>
      E.all([
        E.tryPromise({
          try: () =>
            collection
              .find(documentFilter)
              .sort(pagination.sort ?? { _created: -1 })
              .limit(pagination.limit)
              .skip(pagination.offset)
              .toArray(),
          catch: (cause) => new DatabaseError({ cause, message: "findMany" }),
        }),
        E.tryPromise({
          try: () => collection.countDocuments(documentFilter),
          catch: (cause) =>
            new DatabaseError({ cause, message: "countDocuments" }),
        }),
      ]),
    ),
    E.flatMap(([result, count]) =>
      result
        ? E.succeed([result, count])
        : E.fail(
            new DocumentNotFoundError({
              collection: CollectionName.Queries,
              filter,
            }),
          ),
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
