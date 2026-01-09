import {
  type CollectionNotFoundError,
  DatabaseError,
  type DataValidationError,
  DocumentNotFoundError,
} from "@nildb/common/errors";
import { CollectionName, checkCollectionExists } from "@nildb/common/mongo";
import type { OwnedDocumentBase } from "@nildb/data/data.types";
import type { AppBindings } from "@nildb/env";
import { UserLoggerMapper } from "@nildb/users/users.mapper";
import type { Acl, DataDocumentReference, UserDocument } from "@nildb/users/users.types";
import { Effect as E, pipe } from "effect";
import {
  ObjectId,
  type StrictFilter,
  type StrictUpdateFilter,
  type UpdateFilter,
  type UpdateOptions,
  type UpdateResult,
  type UUID,
} from "mongodb";

import type { PaginationQuery, UserDataLogs } from "@nillion/nildb-types";

const MAX_USER_LOGS = 1000;

/**
 * Upsert user document.
 */
export function upsert(
  ctx: AppBindings,
  user: string,
  data: DataDocumentReference[],
  acl?: Acl,
): E.Effect<void, CollectionNotFoundError | DatabaseError | DataValidationError> {
  const documents = data.map((d) => d.document);
  const createDataLogs = UserLoggerMapper.toCreateDataLogs(documents);
  // Add auth when acl provided
  const grantAccessLogs = UserLoggerMapper.toGrantAccessLogs(documents, acl);
  const logs: UserDataLogs[] = [...createDataLogs, ...grantAccessLogs];

  const filter: StrictFilter<UserDocument> = { did: user };
  const now = new Date();
  const update: UpdateFilter<UserDocument> = {
    // only set when first created
    $setOnInsert: {
      _id: new ObjectId(),
      _created: now,
      did: user,
    },
    // set on every update
    $set: {
      _updated: now,
    },
    $addToSet: {
      data: {
        $each: data,
      },
    },
    $push: {
      logs: {
        $each: logs,
        $slice: -MAX_USER_LOGS,
      },
    },
  };
  const updateOptions: UpdateOptions = { upsert: true };

  return pipe(
    checkCollectionExists<UserDocument>(ctx, "primary", CollectionName.Users),
    E.tryMapPromise({
      try: (collection) => collection.updateOne(filter, update, updateOptions),
      catch: (cause) => new DatabaseError({ cause, message: "upsert" }),
    }),
    E.as(void 0),
  );
}

/**
 * Remove user.
 */
export function removeUser(
  ctx: AppBindings,
  filter: Record<string, unknown>,
): E.Effect<void, CollectionNotFoundError | DatabaseError | DataValidationError> {
  return pipe(
    checkCollectionExists<UserDocument>(ctx, "primary", CollectionName.Users),
    E.tryMapPromise({
      try: (collection) => collection.deleteOne(filter),
      catch: (cause) => new DatabaseError({ cause, message: "remove data" }),
    }),
    E.as(void 0),
  );
}

/**
 * Remove user data.
 */
export function removeData(
  ctx: AppBindings,
  userDid: string,
  data: UUID[],
): E.Effect<void, CollectionNotFoundError | DatabaseError | DataValidationError> {
  const filter: StrictFilter<UserDocument> = { did: userDid };

  const update: UpdateFilter<UserDocument> = {
    $set: {
      _updated: new Date(),
    },
    $pull: {
      data: {
        document: {
          $in: data,
        },
      },
    },
    $push: {
      logs: {
        $each: UserLoggerMapper.toDeleteDataLogs(data),
        $slice: -MAX_USER_LOGS,
      },
    },
  };

  return pipe(
    checkCollectionExists<UserDocument>(ctx, "primary", CollectionName.Users),
    E.tryMapPromise({
      try: (collection) => collection.updateOne(filter, update),
      catch: (cause) => new DatabaseError({ cause, message: "remove data" }),
    }),
    E.as(void 0),
  );
}

/**
 * Update user logs.
 */
export function updateUserLogs(
  ctx: AppBindings,
  userId: string,
  logs: UserDataLogs[],
): E.Effect<void, CollectionNotFoundError | DatabaseError | DataValidationError> {
  const filter = { did: userId };
  const update = {
    $set: {
      _updated: new Date(),
    },
    $push: {
      logs: {
        $each: logs,
        $slice: -MAX_USER_LOGS,
      },
    },
  };
  return pipe(
    checkCollectionExists<UserDocument>(ctx, "primary", CollectionName.Users),
    E.tryMapPromise({
      try: (collection) => collection.updateOne(filter, update),
      catch: (cause) => new DatabaseError({ cause, message: "upsert" }),
    }),
    E.as(void 0),
  );
}

/**
 * Find user by ID.
 */
export function findById(
  ctx: AppBindings,
  user: string,
): E.Effect<UserDocument, DocumentNotFoundError | CollectionNotFoundError | DatabaseError> {
  const filter: StrictFilter<UserDocument> = { did: user };

  return pipe(
    checkCollectionExists<UserDocument>(ctx, "primary", CollectionName.Users),
    E.tryMapPromise({
      try: (collection) => collection.findOne(filter),
      catch: (cause) => new DatabaseError({ cause, message: "findById" }),
    }),
    E.flatMap((result) =>
      result === null
        ? E.fail(
            new DocumentNotFoundError({
              collection: CollectionName.Users,
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
  owner: string,
  acl: Acl,
): E.Effect<UpdateResult, CollectionNotFoundError | DatabaseError | DataValidationError> {
  const filter: StrictFilter<OwnedDocumentBase> = {
    _id: document,
    _owner: owner,
  };

  const update: StrictUpdateFilter<OwnedDocumentBase> = {
    // @ts-expect-error
    $push: {
      _acl: acl,
    },
  };

  return pipe(
    checkCollectionExists<OwnedDocumentBase>(ctx, "data", collection.toString()),
    E.tryMapPromise({
      try: (collection) => collection.updateOne(filter, update),
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
  grantee: string,
  owner: string,
): E.Effect<UpdateResult, CollectionNotFoundError | DatabaseError | DataValidationError> {
  const filter: StrictFilter<OwnedDocumentBase> = {
    _id: document,
    _owner: owner,
  };

  const update: UpdateFilter<OwnedDocumentBase> = {
    // @ts-expect-error
    $pull: {
      _acl: { grantee },
    },
  };

  return pipe(
    checkCollectionExists<OwnedDocumentBase>(ctx, "data", collection.toString()),
    E.tryMapPromise({
      try: (collection) => collection.updateOne(filter, update),
      catch: (cause) => new DatabaseError({ cause, message: "removeAclEntry" }),
    }),
  );
}

/**
 * Finds a paginated list of data references for a specific user using an aggregation pipeline.
 *
 * @param ctx The application bindings.
 * @param user The user's Did.
 * @param pagination The pagination parameters (limit and offset).
 * @returns An object containing the sliced data array and the total number of references.
 */
export function findDataReferences(
  ctx: AppBindings,
  user: string,
  pagination: PaginationQuery,
): E.Effect<
  { data: DataDocumentReference[]; total: number },
  DocumentNotFoundError | CollectionNotFoundError | DatabaseError
> {
  const pipeline = [
    { $match: { did: user } },
    {
      $project: {
        _id: 0,
        data: { $slice: ["$data", pagination.offset, pagination.limit] },
        total: { $size: "$data" },
      },
    },
  ];

  return pipe(
    checkCollectionExists<UserDocument>(ctx, "primary", CollectionName.Users),
    E.tryMapPromise({
      try: (collection) => collection.aggregate<{ data: DataDocumentReference[]; total: number }>(pipeline).next(),
      catch: (cause) => new DatabaseError({ cause, message: "findDataReferences" }),
    }),
    E.flatMap((result) =>
      result
        ? E.succeed(result)
        : E.fail(
            new DocumentNotFoundError({
              collection: CollectionName.Users,
              filter: { did: user },
            }),
          ),
    ),
  );
}
