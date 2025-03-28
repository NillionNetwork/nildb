import { Effect as E, pipe } from "effect";
import type { StrictFilter } from "mongodb";
import {
  DatabaseError,
  DocumentNotFoundError,
  type PrimaryCollectionNotFoundError,
} from "#/common/errors";
import { CollectionName, checkPrimaryCollectionExists } from "#/common/mongo";
import type { Did } from "#/common/types";
import type { AppBindings } from "#/env";
import type {
  AccountDocument,
  AdminAccountDocument,
  AdminCreateAccountRequest,
} from "./admin.types";

export function toAdminAccountDocument(
  data: AdminCreateAccountRequest,
): AdminAccountDocument {
  const { did, name } = data;
  const now = new Date();

  return {
    _id: did,
    _type: "admin",
    _created: now,
    _updated: now,
    name,
  };
}

export function deleteOneById(
  ctx: AppBindings,
  _id: Did,
): E.Effect<
  void,
  DocumentNotFoundError | PrimaryCollectionNotFoundError | DatabaseError
> {
  const filter: StrictFilter<AccountDocument> = {
    _id,
  };

  return pipe(
    checkPrimaryCollectionExists<AccountDocument>(ctx, CollectionName.Accounts),
    E.flatMap((collection) =>
      E.tryPromise({
        try: () => collection.deleteOne(filter),
        catch: (cause: unknown) =>
          new DatabaseError({ cause, message: "deleteOneById" }),
      }),
    ),
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

export function insert(
  ctx: AppBindings,
  document: AdminAccountDocument,
): E.Effect<void, PrimaryCollectionNotFoundError | DatabaseError> {
  return pipe(
    checkPrimaryCollectionExists<AccountDocument>(ctx, CollectionName.Accounts),
    E.flatMap((collection) =>
      E.tryPromise({
        try: () => collection.insertOne(document),
        catch: (cause: unknown) =>
          new DatabaseError({ cause, message: "insert" }),
      }),
    ),
    E.as(void 0),
  );
}

export function listAll(
  ctx: AppBindings,
): E.Effect<AccountDocument[], PrimaryCollectionNotFoundError | DatabaseError> {
  return pipe(
    checkPrimaryCollectionExists<AccountDocument>(ctx, CollectionName.Accounts),
    E.flatMap((collection) =>
      E.tryPromise({
        try: () => collection.find({}).toArray(),
        catch: (cause: unknown) =>
          new DatabaseError({ cause, message: "listAll" }),
      }),
    ),
  );
}
