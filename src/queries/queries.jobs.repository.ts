import { Effect as E, pipe } from "effect";
import {
  type InsertOneResult,
  type StrictFilter,
  type StrictUpdateFilter,
  UUID,
} from "mongodb";
import {
  DatabaseError,
  DocumentNotFoundError,
  type PrimaryCollectionNotFoundError,
} from "#/common/errors";
import { CollectionName, checkPrimaryCollectionExists } from "#/common/mongo";
import type { AppBindings } from "#/env";
import type { QueryJobDocument } from "./queries.types";

export function toQueryJobDocument(queryId: UUID): QueryJobDocument {
  const now = new Date();

  return {
    _id: new UUID(),
    _created: now,
    _updated: now,
    status: "pending",
    queryId,
  };
}

export function insert(
  ctx: AppBindings,
  document: QueryJobDocument,
): E.Effect<
  InsertOneResult<QueryJobDocument>,
  PrimaryCollectionNotFoundError | DatabaseError
> {
  return pipe(
    checkPrimaryCollectionExists<QueryJobDocument>(
      ctx,
      CollectionName.JobsQueries,
    ),
    E.tryMapPromise({
      try: (collection) => collection.insertOne(document),
      catch: (cause) => new DatabaseError({ cause, message: "insert" }),
    }),
  );
}

export function findOne(
  ctx: AppBindings,
  filter: StrictFilter<QueryJobDocument>,
): E.Effect<
  QueryJobDocument,
  DocumentNotFoundError | PrimaryCollectionNotFoundError | DatabaseError
> {
  return pipe(
    checkPrimaryCollectionExists<QueryJobDocument>(
      ctx,
      CollectionName.JobsQueries,
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
              collection: CollectionName.JobsQueries,
              filter,
            }),
          ),
    ),
  );
}

export function updateOne(
  ctx: AppBindings,
  jobId: UUID,
  data: Partial<QueryJobDocument>,
): E.Effect<
  void,
  DocumentNotFoundError | PrimaryCollectionNotFoundError | DatabaseError
> {
  const filter: StrictFilter<QueryJobDocument> = { _id: jobId };
  const update: StrictUpdateFilter<QueryJobDocument> = {
    $set: data,
  };

  return pipe(
    checkPrimaryCollectionExists<QueryJobDocument>(
      ctx,
      CollectionName.JobsQueries,
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
              collection: CollectionName.JobsQueries,
              filter,
            }),
          ),
    ),
  );
}
