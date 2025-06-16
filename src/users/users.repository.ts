import { Effect as E, pipe } from "effect";
import type {
  StrictFilter,
  StrictUpdateFilter,
  UpdateFilter,
  UpdateOptions,
  UpdateResult,
  UUID,
} from "mongodb";
import {
  type CollectionNotFoundError,
  DatabaseError,
  type DataValidationError,
  DocumentNotFoundError,
} from "#/common/errors";
import { CollectionName, checkCollectionExists } from "#/common/mongo";
import type { Did } from "#/common/types";
import type { OwnedDocumentBase } from "#/data/data.types";
import type { AppBindings } from "#/env";
import type { Acl, LogOperation, UserDocument } from "#/users/users.types";

type UpsertOptions = {
  builder: Did;
  collection: UUID;
  user: Did;
  data: UUID[];
  acl?: Acl;
};

/**
 * Upsert user document.
 */
export function upsert(
  ctx: AppBindings,
  options: UpsertOptions,
): E.Effect<
  void,
  CollectionNotFoundError | DatabaseError | DataValidationError
> {
  const { builder, collection, user, data, acl } = options;
  const filter: StrictFilter<UserDocument> = { _id: user };

  const logOperations: LogOperation[] = [];
  for (const col of data) {
    logOperations.push({ op: "write", col });
  }

  // Add auth when acl provided
  if (acl) {
    for (const col of data) {
      logOperations.push({ op: "auth", col, acl });
    }
  }

  const update: UpdateFilter<UserDocument> = {
    // only set when first created
    $setOnInsert: {
      _created: new Date(),
    },
    // set on every update
    $set: {
      _updated: new Date(),
    },
    $addToSet: {
      data: {
        $each: data.map((document) => ({ builder, collection, document })),
      },
      log: {
        $each: logOperations,
      },
    },
  };

  const updateOptions: UpdateOptions = { upsert: true };

  return pipe(
    checkCollectionExists<UserDocument>(ctx, "primary", CollectionName.User),
    E.tryMapPromise({
      try: (collection) => collection.updateOne(filter, update, updateOptions),
      catch: (cause) => new DatabaseError({ cause, message: "upsert" }),
    }),
    E.as(void 0),
  );
}

/**
 * Remove user data.
 */
export function removeData(
  ctx: AppBindings,
  user: Did,
  data: UUID[],
): E.Effect<
  void,
  CollectionNotFoundError | DatabaseError | DataValidationError
> {
  const filter: StrictFilter<UserDocument> = { _id: user };

  const logOperations: LogOperation[] = data.map((col) => ({
    op: "delete",
    col,
  }));

  const update: UpdateFilter<UserDocument> = {
    $set: {
      _updated: new Date(),
    },
    $pull: {
      data: {
        document: {
          $in: data.map((uuid) => uuid),
        },
      },
    },
    $addToSet: {
      log: {
        $each: logOperations,
      },
    },
  };

  const options: UpdateOptions = { upsert: true };

  return pipe(
    checkCollectionExists<UserDocument>(ctx, "primary", CollectionName.User),
    E.tryMapPromise({
      try: (collection) => collection.updateOne(filter, update, options),
      catch: (cause) => new DatabaseError({ cause, message: "remove data" }),
    }),
    E.as(void 0),
  );
}

/**
 * Find user by ID.
 */
export function findById(
  ctx: AppBindings,
  user: Did,
): E.Effect<
  UserDocument,
  DocumentNotFoundError | CollectionNotFoundError | DatabaseError
> {
  const filter: StrictFilter<UserDocument> = { _id: user };

  return pipe(
    checkCollectionExists<UserDocument>(ctx, "primary", CollectionName.User),
    E.tryMapPromise({
      try: (collection) => collection.findOne(filter),
      catch: (cause) => new DatabaseError({ cause, message: "findById" }),
    }),
    E.flatMap((result) =>
      result === null
        ? E.fail(
            new DocumentNotFoundError({
              collection: CollectionName.User,
              filter,
            }),
          )
        : E.succeed(result),
    ),
  );
}

/**
 * Add ACL entry.
 */
export function addAclEntry(
  ctx: AppBindings,
  collection: UUID,
  document: UUID,
  owner: Did,
  acl: Acl,
): E.Effect<
  UpdateResult,
  CollectionNotFoundError | DatabaseError | DataValidationError
> {
  const filter: StrictFilter<OwnedDocumentBase> = {
    _id: document,
    _owner: owner,
  };

  const update: StrictUpdateFilter<OwnedDocumentBase> = {
    // @ts-expect-error
    $push: { _acl: acl },
  };

  return pipe(
    checkCollectionExists<OwnedDocumentBase>(
      ctx,
      "data",
      collection.toString(),
    ),
    E.tryMapPromise({
      try: (collection) =>
        collection.updateOne(filter, update, { upsert: true }),
      catch: (cause) => new DatabaseError({ cause, message: "addAclEntry" }),
    }),
  );
}

/**
 * Remove ACL entry.
 */
export function removeAclEntry(
  ctx: AppBindings,
  collection: UUID,
  document: UUID,
  grantee: Did,
  owner: Did,
): E.Effect<
  UpdateResult,
  CollectionNotFoundError | DatabaseError | DataValidationError
> {
  const filter: StrictFilter<OwnedDocumentBase> = {
    id: document,
    _owner: owner,
  };

  const update: UpdateFilter<OwnedDocumentBase> = {
    // @ts-expect-error
    $pull: { _acl: { grantee } },
  };

  return pipe(
    checkCollectionExists<OwnedDocumentBase>(
      ctx,
      "data",
      collection.toString(),
    ),
    E.tryMapPromise({
      try: (collection) => collection.updateOne(filter, update),
      catch: (cause) => new DatabaseError({ cause, message: "removeAclEntry" }),
    }),
  );
}
