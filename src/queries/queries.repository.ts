import { Effect as E, pipe } from "effect";
import type { StrictFilter } from "mongodb";
import type { Filter } from "mongodb/lib/beta";
import {
  DatabaseError,
  type DataValidationError,
  DocumentNotFoundError,
  type PrimaryCollectionNotFoundError,
} from "#/common/errors";
import {
  addDocumentBaseCoercions,
  applyCoercions,
  CollectionName,
  checkPrimaryCollectionExists,
} from "#/common/mongo";
import type { CoercibleMap } from "#/common/types";
import type { AppBindings } from "#/env";
import type { QueryDocument } from "./queries.types";

export function insert(
  ctx: AppBindings,
  document: QueryDocument,
): E.Effect<void, PrimaryCollectionNotFoundError | DatabaseError> {
  return pipe(
    checkPrimaryCollectionExists<QueryDocument>(ctx, CollectionName.Queries),
    E.tryMapPromise({
      try: (collection) => collection.insertOne(document),
      catch: (cause) => new DatabaseError({ cause, message: "insert" }),
    }),
    E.as(void 0),
  );
}

export function findMany(
  ctx: AppBindings,
  filter: StrictFilter<QueryDocument>,
): E.Effect<
  QueryDocument[],
  | DocumentNotFoundError
  | PrimaryCollectionNotFoundError
  | DatabaseError
  | DataValidationError
> {
  return pipe(
    E.all([
      checkPrimaryCollectionExists<QueryDocument>(ctx, CollectionName.Queries),
      applyCoercions<Filter<QueryDocument>>(addDocumentBaseCoercions(filter)),
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
              collection: CollectionName.Schemas,
              filter,
            }),
          )
        : E.succeed(result),
    ),
  );
}

export function findOne(
  ctx: AppBindings,
  filter: StrictFilter<QueryDocument>,
): E.Effect<
  QueryDocument,
  | DocumentNotFoundError
  | PrimaryCollectionNotFoundError
  | DatabaseError
  | DataValidationError
> {
  return pipe(
    E.all([
      checkPrimaryCollectionExists<QueryDocument>(ctx, CollectionName.Queries),
      applyCoercions<Filter<QueryDocument>>(addDocumentBaseCoercions(filter)),
    ]),
    E.tryMapPromise({
      try: ([collection, documentFilter]) => collection.findOne(documentFilter),
      catch: (cause) => new DatabaseError({ cause, message: "findOne" }),
    }),
    E.flatMap((result) =>
      result === null
        ? E.fail(
            new DocumentNotFoundError({
              collection: CollectionName.Schemas,
              filter,
            }),
          )
        : E.succeed(result),
    ),
  );
}

export function findOneAndDelete(
  ctx: AppBindings,
  filter: StrictFilter<QueryDocument>,
): E.Effect<
  QueryDocument,
  | DocumentNotFoundError
  | PrimaryCollectionNotFoundError
  | DatabaseError
  | DataValidationError
> {
  return pipe(
    E.all([
      checkPrimaryCollectionExists<QueryDocument>(ctx, CollectionName.Queries),
      applyCoercions<Filter<QueryDocument>>(addDocumentBaseCoercions(filter)),
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
              collection: CollectionName.Schemas,
              filter,
            }),
          )
        : E.succeed(result),
    ),
  );
}

export function addQueryDocumentCoercions(
  coercibleMap: CoercibleMap,
): CoercibleMap {
  return addDocumentBaseCoercions(coercibleMap);
}
