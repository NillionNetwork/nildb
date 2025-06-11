import { Effect as E, pipe } from "effect";
import type { StrictFilter, UpdateResult, UUID } from "mongodb";
import {
  type CollectionNotFoundError,
  DatabaseError,
  type DataValidationError,
  DocumentNotFoundError,
} from "#/common/errors";
import { CollectionName, checkCollectionExists } from "#/common/mongo";
import type { Did } from "#/common/types";
import type { DataDocumentBase } from "#/data/data.repository";
import type { AppBindings } from "#/env";
import type { GrantedAccess } from "#/user/user.dto";
import { LoggerOperationMapper } from "#/user/user.mapper";
import type {
  DataDocumentReference,
  LogOperation,
  UserDocument,
} from "#/user/user.types";

export function updateData(
  ctx: AppBindings,
  userId: Did,
  data: DataDocumentReference[],
): E.Effect<
  void,
  CollectionNotFoundError | DatabaseError | DataValidationError
> {
  const filter = { _id: userId };
  const now = new Date();
  const update = {
    $set: {
      _created: now,
      _updated: now,
    },
    $push: {
      data: {
        $each: data,
      },
      log: {
        $each: LoggerOperationMapper.toMultipleCreateDataLogOperation(
          data.map((d) => d.id),
        ),
      },
    },
  };
  const options = { upsert: true };
  return pipe(
    checkCollectionExists<UserDocument>(ctx, "primary", CollectionName.User),
    E.tryMapPromise({
      try: (collection) => collection.updateOne(filter, update, options),
      catch: (cause) => new DatabaseError({ cause, message: "upsert" }),
    }),
    E.as(void 0),
  );
}

export function pushLogs(
  ctx: AppBindings,
  userId: Did,
  logOperations: LogOperation[],
): E.Effect<
  void,
  CollectionNotFoundError | DatabaseError | DataValidationError
> {
  const filter = { _id: userId };
  const update = {
    $setOnInsert: {
      _updated: new Date(),
    },
    $push: {
      log: {
        $each: logOperations,
      },
    },
  };
  return pipe(
    checkCollectionExists<UserDocument>(ctx, "primary", CollectionName.User),
    E.tryMapPromise({
      try: (collection) => collection.updateOne(filter, update),
      catch: (cause) => new DatabaseError({ cause, message: "upsert" }),
    }),
    E.as(void 0),
  );
}

export function removeData(
  ctx: AppBindings,
  userId: Did,
  data: UUID[],
): E.Effect<
  void,
  CollectionNotFoundError | DatabaseError | DataValidationError
> {
  return pipe(
    checkCollectionExists<UserDocument>(ctx, "primary", CollectionName.User),
    E.tryMapPromise({
      try: (collection) =>
        collection.updateOne(
          {
            _id: userId,
          },
          {
            $set: {
              _updated: new Date(),
            },
            $pull: {
              data: {
                id: {
                  $in: data,
                },
              },
            },
            $push: {
              log: {
                $each:
                  LoggerOperationMapper.toMultipleDeleteDataLogOperation(data),
              },
            },
          },
        ),
      catch: (cause) => new DatabaseError({ cause, message: "remove data" }),
    }),
    E.as(void 0),
  );
}

export function findById(
  ctx: AppBindings,
  userId: Did,
): E.Effect<
  UserDocument,
  DocumentNotFoundError | CollectionNotFoundError | DatabaseError
> {
  const filter: StrictFilter<UserDocument> = { _id: userId };
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

export function addPermissions(
  ctx: AppBindings,
  schema: UUID,
  documentId: UUID,
  grantAccess: GrantedAccess,
): E.Effect<
  UpdateResult,
  CollectionNotFoundError | DatabaseError | DataValidationError
> {
  const documentFilter = {
    _id: documentId,
  };
  const documentUpdate = {
    $push: {
      _grantedAccess: grantAccess,
    },
  };
  return pipe(
    checkCollectionExists<DataDocumentBase>(ctx, "data", schema.toString()),
    E.tryMapPromise({
      try: (collection) =>
        collection.updateOne(documentFilter, documentUpdate, { upsert: true }),
      catch: (cause) =>
        new DatabaseError({ cause, message: "upsertPermissions" }),
    }),
  );
}

export function updatePermissions(
  ctx: AppBindings,
  schema: UUID,
  documentId: UUID,
  grantAccess: GrantedAccess,
): E.Effect<
  UpdateResult,
  CollectionNotFoundError | DatabaseError | DataValidationError
> {
  const documentFilter = {
    _id: documentId,
    "_grantedAccess.did": grantAccess.did,
  };
  const documentUpdate = {
    $set: {
      "_grantedAccess.$": grantAccess,
    },
  };
  return pipe(
    checkCollectionExists<DataDocumentBase>(ctx, "data", schema.toString()),
    E.tryMapPromise({
      try: (collection) => collection.updateOne(documentFilter, documentUpdate),
      catch: (cause) =>
        new DatabaseError({ cause, message: "updatePermissions" }),
    }),
  );
}

export function deletePermissions(
  ctx: AppBindings,
  schema: UUID,
  documentId: UUID,
  did: Did,
): E.Effect<
  UpdateResult,
  CollectionNotFoundError | DatabaseError | DataValidationError
> {
  const documentFilter = {
    _id: documentId,
  };
  const documentUpdate = {
    $pull: {
      _grantedAccess: { did },
    },
  };
  return pipe(
    checkCollectionExists<DataDocumentBase>(ctx, "data", schema.toString()),
    E.tryMapPromise({
      try: (collection) => collection.updateOne(documentFilter, documentUpdate),
      catch: (cause) =>
        new DatabaseError({ cause, message: "deletePermissions" }),
    }),
  );
}
