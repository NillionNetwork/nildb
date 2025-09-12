import { Effect as E, pipe } from "effect";
import {
  type InsertOneResult,
  type StrictFilter,
  type StrictUpdateFilter,
  UUID,
} from "mongodb";
import {
  type CollectionNotFoundError,
  DatabaseError,
  DocumentNotFoundError,
} from "#/common/errors";
import { CollectionName, checkCollectionExists } from "#/common/mongo";
import type { PaginationQuery } from "#/common/pagination.dto";
import type { AppBindings } from "#/env";
import type { RunQueryJobDocument } from "./queries.types";

/**
 * Create query job document.
 */
export function toRunQueryJobDocument(queryId: UUID): RunQueryJobDocument {
  const now = new Date();

  return {
    _id: new UUID(),
    _created: now,
    _updated: now,
    status: "pending",
    query: queryId,
    started: new Date(0),
    completed: new Date(0),
    result: {},
    errors: [],
  };
}

/**
 * Insert query job document.
 */
export function insert(
  ctx: AppBindings,
  document: RunQueryJobDocument,
): E.Effect<
  InsertOneResult<RunQueryJobDocument>,
  CollectionNotFoundError | DatabaseError
> {
  return pipe(
    checkCollectionExists<RunQueryJobDocument>(
      ctx,
      "primary",
      CollectionName.QueryRuns,
    ),
    E.tryMapPromise({
      try: (collection) => collection.insertOne(document),
      catch: (cause) => new DatabaseError({ cause, message: "insert" }),
    }),
  );
}

/**
 * Find query job by filter.
 */
export function findOne(
  ctx: AppBindings,
  filter: StrictFilter<RunQueryJobDocument>,
): E.Effect<
  RunQueryJobDocument,
  DocumentNotFoundError | CollectionNotFoundError | DatabaseError
> {
  return pipe(
    checkCollectionExists<RunQueryJobDocument>(
      ctx,
      "primary",
      CollectionName.QueryRuns,
    ),
    E.tryMapPromise({
      try: (collection) => collection.findOne(filter),
      catch: (cause) => new DatabaseError({ cause, message: "findOne" }),
    }),
    E.flatMap((document) =>
      document
        ? E.succeed(document)
        : E.fail(
            new DocumentNotFoundError({
              collection: CollectionName.QueryRuns,
              filter,
            }),
          ),
    ),
  );
}

/**
 * Finds a query run by ID and paginates its result array using an aggregation pipeline.
 */
export function findRunByIdWithPaginatedResults(
  ctx: AppBindings,
  _id: UUID,
  pagination: PaginationQuery,
): E.Effect<
  (RunQueryJobDocument & { total: number }) | null,
  CollectionNotFoundError | DatabaseError
> {
  const pipeline = [
    { $match: { _id } },
    {
      $project: {
        _id: 1,
        _created: 1,
        _updated: 1,
        query: 1,
        status: 1,
        started: 1,
        completed: 1,
        errors: 1,
        total: { $size: { $ifNull: ["$result", []] } },
        result: { $slice: ["$result", pagination.offset, pagination.limit] },
      },
    },
  ];

  return pipe(
    checkCollectionExists<RunQueryJobDocument>(
      ctx,
      "primary",
      CollectionName.QueryRuns,
    ),
    E.tryMapPromise({
      try: (collection) =>
        collection
          .aggregate<RunQueryJobDocument & { total: number }>(pipeline)
          .next(),
      catch: (cause) =>
        new DatabaseError({
          cause,
          message: "findRunByIdWithPaginatedResults",
        }),
    }),
  );
}

/**
 * Update query job.
 */
export function updateOne(
  ctx: AppBindings,
  _id: UUID,
  data: Partial<RunQueryJobDocument>,
): E.Effect<
  void,
  DocumentNotFoundError | CollectionNotFoundError | DatabaseError
> {
  const filter: StrictFilter<RunQueryJobDocument> = { _id };

  const update: StrictUpdateFilter<RunQueryJobDocument> = {
    $set: data,
  };

  return pipe(
    checkCollectionExists<RunQueryJobDocument>(
      ctx,
      "primary",
      CollectionName.QueryRuns,
    ),
    E.tryMapPromise({
      try: (collection) => collection.updateOne(filter, update),
      catch: (cause) => new DatabaseError({ cause, message: "updateOne" }),
    }),
    E.flatMap((document) =>
      document
        ? E.succeed(document)
        : E.fail(
            new DocumentNotFoundError({
              collection: CollectionName.QueryRuns,
              filter,
            }),
          ),
    ),
  );
}
