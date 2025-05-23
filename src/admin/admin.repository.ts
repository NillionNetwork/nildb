import { Effect as E, pipe } from "effect";
import type { StrictFilter } from "mongodb";
import {
  type CollectionNotFoundError,
  DatabaseError,
  DocumentNotFoundError,
} from "#/common/errors";
import { checkCollectionExists, CollectionName } from "#/common/mongo";
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
    _created: now,
    _updated: now,
    _role: "admin",
    name,
  };
}

export function deleteOneById(
  ctx: AppBindings,
  _id: Did,
): E.Effect<
  void,
  DocumentNotFoundError | CollectionNotFoundError | DatabaseError
> {
  const filter: StrictFilter<AccountDocument> = {
    _id,
  };

  return pipe(
    checkCollectionExists<AccountDocument>(
      ctx,
      "primary",
      CollectionName.Accounts,
    ),
    E.tryMapPromise({
      try: (collection) => collection.deleteOne(filter),
      catch: (cause: unknown) =>
        new DatabaseError({ cause, message: "deleteOneById" }),
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

export function insert(
  ctx: AppBindings,
  document: AdminAccountDocument,
): E.Effect<void, CollectionNotFoundError | DatabaseError> {
  return pipe(
    checkCollectionExists<AccountDocument>(
      ctx,
      "primary",
      CollectionName.Accounts,
    ),
    E.tryMapPromise({
      try: (collection) => collection.insertOne(document),
      catch: (cause: unknown) =>
        new DatabaseError({ cause, message: "insert" }),
    }),
    E.as(void 0),
  );
}

export function listAll(
  ctx: AppBindings,
): E.Effect<AccountDocument[], CollectionNotFoundError | DatabaseError> {
  return pipe(
    checkCollectionExists<AccountDocument>(
      ctx,
      "primary",
      CollectionName.Accounts,
    ),
    E.tryMapPromise({
      try: (collection) => collection.find({}).toArray(),
      catch: (cause: unknown) =>
        new DatabaseError({ cause, message: "listAll" }),
    }),
  );
}
