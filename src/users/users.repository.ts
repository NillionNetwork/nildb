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
import { Did } from "#/common/types";
import * as DataRepository from "#/data/data.repository";
import type {
  OwnedDocumentBase,
  StandardDocumentBase,
} from "#/data/data.types";
import type { AppBindings } from "#/env";
import type { UserDataLogs } from "#/users/users.dto";
import { UserLoggerMapper } from "#/users/users.mapper";
import type {
  Acl,
  DataDocumentReference,
  UserDocument,
} from "#/users/users.types";

type UpsertOptions = {
  user: Did;
  data: DataDocumentReference[];
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
  const { user, data, acl } = options;

  const documents = data.map((d) => d.document);
  const createDataLogs = UserLoggerMapper.toCreateDataLogs(documents);
  // Add auth when acl provided
  const grantAccessLogs = UserLoggerMapper.toGrantAccessLogs(documents, acl);
  const logs: UserDataLogs[] = [...createDataLogs, ...grantAccessLogs];

  const filter: StrictFilter<UserDocument> = { _id: user };
  const now = new Date();
  const update: UpdateFilter<UserDocument> = {
    // only set when first created
    $setOnInsert: {
      _created: now,
    },
    // set on every update
    $set: {
      _updated: now,
    },
    $addToSet: {
      data: {
        $each: data,
      },
      logs: {
        $each: logs,
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

// This endpoint can be invoked against a standard and owned collections,
// meaning that when the target is an owned collection we also need to
// update the user's document
export function groupByOwner(
  documents: StandardDocumentBase[],
): Record<string, UUID[]> {
  return documents.reduce<Record<string, UUID[]>>((acc, data) => {
    if ("_owner" in data) {
      const document = data as OwnedDocumentBase;
      const { _owner } = document;

      if (!acc[_owner]) {
        acc[_owner] = [];
      }

      acc[_owner].push(data._id);
    }

    return acc;
  }, {});
}

export function deleteUserDataReferences(
  ctx: AppBindings,
  collection: UUID,
  filter: Record<string, unknown>,
): E.Effect<
  void,
  CollectionNotFoundError | DatabaseError | DataValidationError,
  never
> {
  function deleteDataReferences(
    ctx: AppBindings,
    documents: Record<Did, UUID[]>,
  ): E.Effect<
    void,
    CollectionNotFoundError | DatabaseError | DataValidationError
  > {
    return E.forEach(Object.entries(documents), ([owner, ids]) => {
      const user = Did.parse(owner);
      return pipe(
        removeData(ctx, user, ids),
        E.flatMap(() => removeUser(ctx, { _id: user, data: { $size: 0 } })),
      );
    });
  }

  const findFilter = {
    ...filter,
    _owner: { $exists: true }, // Ensure we only update owned documents
  };
  return pipe(
    DataRepository.findMany(ctx, collection, findFilter),
    // This returns the owned documents grouped by owner, the standard documents are skipped.
    E.map((documents) => groupByOwner(documents)),
    E.flatMap((ownedDocuments) => deleteDataReferences(ctx, ownedDocuments)),
  );
}

/**
 * Remove user.
 */
export function removeUser(
  ctx: AppBindings,
  filter: Record<string, unknown>,
): E.Effect<
  void,
  CollectionNotFoundError | DatabaseError | DataValidationError
> {
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
  user: Did,
  data: UUID[],
): E.Effect<
  void,
  CollectionNotFoundError | DatabaseError | DataValidationError
> {
  const filter: StrictFilter<UserDocument> = { _id: user };

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
    $addToSet: {
      logs: {
        $each: UserLoggerMapper.toDeleteDataLogs(data),
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
  userId: Did,
  logs: UserDataLogs[],
): E.Effect<
  void,
  CollectionNotFoundError | DatabaseError | DataValidationError
> {
  const filter = { _id: userId };
  const update = {
    $set: {
      _updated: new Date(),
    },
    $push: {
      logs: {
        $each: logs,
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
  user: Did,
): E.Effect<
  UserDocument,
  DocumentNotFoundError | CollectionNotFoundError | DatabaseError
> {
  const filter: StrictFilter<UserDocument> = { _id: user };

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
    $push: {
      _acl: acl,
    },
  };

  return pipe(
    checkCollectionExists<OwnedDocumentBase>(
      ctx,
      "data",
      collection.toString(),
    ),
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
  grantee: Did,
  owner: Did,
): E.Effect<
  UpdateResult,
  CollectionNotFoundError | DatabaseError | DataValidationError
> {
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
