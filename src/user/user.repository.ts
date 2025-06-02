import { Effect as E, pipe } from "effect";
import type { StrictFilter, UpdateResult, UUID } from "mongodb";
import {
  type CollectionNotFoundError,
  DatabaseError,
  type DataValidationError,
  DocumentNotFoundError,
} from "#/common/errors";
import {
  CollectionName,
  checkCollectionExists,
  type DocumentBase,
} from "#/common/mongo";
import type { Did } from "#/common/types";
import type { DataDocumentBase } from "#/data/data.repository";
import type { AppBindings } from "#/env";
import type { Permissions } from "#/user/user.types";

export type LogOperation =
  | { op: "write"; col: UUID }
  | { op: "delete"; col: UUID }
  | { op: "auth"; col: UUID; perms: Permissions };

export type DataDocumentReference = {
  id: UUID;
  schema: UUID;
};

export type UserDocument = DocumentBase<Did> & {
  data: DataDocumentReference[];
  log: LogOperation[];
};

export function upsert(
  ctx: AppBindings,
  userId: Did,
  schema: UUID,
  data: UUID[],
  perms?: Permissions,
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
              _created: new Date(),
            },
            $setOnInsert: {
              _updated: new Date(),
            },
            $addToSet: {
              data: {
                $each: data.map((col) => ({ id: col, schema })),
              },
              log: {
                $each: [
                  ...data.map((col) => ({ op: "write", col }) as LogOperation),
                  ...(perms
                    ? data.map(
                        (col) =>
                          ({
                            op: "auth",
                            col,
                            perms,
                          }) as LogOperation,
                      )
                    : []),
                ],
              },
            },
          },
          { upsert: true },
        ),
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
                  $in: data.map((uuid) => uuid),
                },
              },
            },
            $addToSet: {
              log: {
                $each: data.map((col) => ({ op: "delete", col })),
              },
            },
          },
          { upsert: true },
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
      catch: (cause) => new DatabaseError({ cause, message: "findOneUser" }),
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
  perms: Permissions,
): E.Effect<
  UpdateResult,
  CollectionNotFoundError | DatabaseError | DataValidationError
> {
  const documentFilter = {
    _id: documentId,
  };
  const documentUpdate = {
    $push: {
      _perms: perms,
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
  perms: Permissions,
): E.Effect<
  UpdateResult,
  CollectionNotFoundError | DatabaseError | DataValidationError
> {
  const documentFilter = {
    _id: documentId,
    "_perms.did": perms.did,
  };
  const documentUpdate = {
    $set: {
      "_perms.$": perms,
    },
  };
  return pipe(
    checkCollectionExists<DataDocumentBase>(ctx, "data", schema.toString()),
    E.tryMapPromise({
      try: (collection) => collection.updateOne(documentFilter, documentUpdate),
      catch: (cause) =>
        new DatabaseError({ cause, message: "upsertPermissions" }),
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
      _perms: { did },
    },
  };
  return pipe(
    checkCollectionExists<DataDocumentBase>(ctx, "data", schema.toString()),
    E.tryMapPromise({
      try: (collection) => collection.updateOne(documentFilter, documentUpdate),
      catch: (cause) =>
        new DatabaseError({ cause, message: "upsertPermissions" }),
    }),
  );
}
