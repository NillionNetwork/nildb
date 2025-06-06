import { Effect as E, pipe } from "effect";
import type { StrictFilter, StrictUpdateFilter, UUID } from "mongodb";
import type { BuilderDocument } from "#/builders/builders.types";
import {
  type CollectionNotFoundError,
  DatabaseError,
  DocumentNotFoundError,
} from "#/common/errors";
import { CollectionName, checkCollectionExists } from "#/common/mongo";
import type { Did } from "#/common/types";
import type { AppBindings } from "#/env";

export function addSchema(
  ctx: AppBindings,
  owner: Did,
  schemaId: UUID,
): E.Effect<
  void,
  DocumentNotFoundError | CollectionNotFoundError | DatabaseError
> {
  const filter: StrictFilter<BuilderDocument> = { _id: owner };
  const update: StrictUpdateFilter<BuilderDocument> = {
    $addToSet: { schemas: schemaId },
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

export function removeSchema(
  ctx: AppBindings,
  orgDid: Did,
  schemaId: UUID,
): E.Effect<
  void,
  DocumentNotFoundError | CollectionNotFoundError | DatabaseError
> {
  const filter: StrictFilter<BuilderDocument> = { _id: orgDid };
  const update: StrictUpdateFilter<BuilderDocument> = {
    $pull: { schemas: schemaId },
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

export function addQuery(
  ctx: AppBindings,
  orgId: Did,
  queryId: UUID,
): E.Effect<
  void,
  DocumentNotFoundError | CollectionNotFoundError | DatabaseError
> {
  const filter: StrictFilter<BuilderDocument> = { _id: orgId };
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
  const filter: StrictFilter<BuilderDocument> = { _id: orgId };
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
