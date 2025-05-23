import { Effect as E, pipe } from "effect";
import type { StrictFilter, StrictUpdateFilter, UpdateResult } from "mongodb";
import type { AccountDocument } from "#/admin/admin.types";
import {
  type CollectionNotFoundError,
  DatabaseError,
  DocumentNotFoundError,
} from "#/common/errors";
import { checkCollectionExists, CollectionName } from "#/common/mongo";
import type { Did } from "#/common/types";
import type { AppBindings } from "#/env";
import type {
  OrganizationAccountDocument,
  RegisterAccountRequest,
} from "./accounts.types";

export function toOrganizationAccountDocument(
  data: RegisterAccountRequest,
): OrganizationAccountDocument {
  const { did, name } = data;
  const now = new Date();

  return {
    _id: did,
    _created: now,
    _updated: now,
    _role: "organization",
    name,
    schemas: [],
    queries: [],
  };
}

export function insert(
  ctx: AppBindings,
  document: OrganizationAccountDocument,
): E.Effect<void, CollectionNotFoundError | DatabaseError> {
  return pipe(
    checkCollectionExists<OrganizationAccountDocument>(
      ctx,
      "primary",
      CollectionName.Accounts,
    ),
    E.tryMapPromise({
      try: (collection) => collection.insertOne(document),
      catch: (cause) => new DatabaseError({ cause, message: "insert" }),
    }),
    E.as(void 0),
  );
}

export function findByIdWithCache(
  ctx: AppBindings,
  _id: Did,
): E.Effect<
  AccountDocument,
  DocumentNotFoundError | CollectionNotFoundError | DatabaseError
> {
  const cache = ctx.cache.accounts;
  const account = cache.get(_id);
  if (account) {
    return E.succeed(account);
  }

  const filter = { _id };

  return pipe(
    checkCollectionExists<AccountDocument>(
      ctx,
      "system",
      CollectionName.Accounts,
    ),
    E.tryMapPromise({
      try: (collection) => collection.findOne(filter),
      catch: (cause) =>
        new DatabaseError({ cause, message: "findByIdWithCache" }),
    }),
    E.flatMap((result) =>
      result === null
        ? E.fail(
            new DocumentNotFoundError({
              collection: CollectionName.Accounts,
              filter,
            }),
          )
        : E.succeed(result),
    ),
    E.tap((document) => cache.set(_id, document)),
  );
}

export function findOneOrganization(
  ctx: AppBindings,
  _id: Did,
): E.Effect<
  OrganizationAccountDocument,
  DocumentNotFoundError | CollectionNotFoundError | DatabaseError
> {
  const filter: StrictFilter<OrganizationAccountDocument> = {
    _id,
    _role: "organization",
  };
  return pipe(
    checkCollectionExists<OrganizationAccountDocument>(
      ctx,
      "primary",
      CollectionName.Accounts,
    ),
    E.tryMapPromise({
      try: (collection) => collection.findOne(filter),
      catch: (cause) =>
        new DatabaseError({ cause, message: "findOneOrganization" }),
    }),
    E.flatMap((result) =>
      result === null
        ? E.fail(
            new DocumentNotFoundError({
              collection: CollectionName.Accounts,
              filter,
            }),
          )
        : E.succeed(result),
    ),
  );
}

export function deleteOneById(
  ctx: AppBindings,
  _id: Did,
): E.Effect<
  void,
  DocumentNotFoundError | CollectionNotFoundError | DatabaseError
> {
  const filter: StrictFilter<OrganizationAccountDocument> = {
    _id,
    _role: "organization",
  };

  return pipe(
    checkCollectionExists<OrganizationAccountDocument>(
      ctx,
      "primary",
      CollectionName.Accounts,
    ),
    E.tryMapPromise({
      try: (collection) => collection.deleteOne(filter),
      catch: (cause) => new DatabaseError({ cause, message: "deleteOneById" }),
    }),
    E.flatMap((result) =>
      result === null
        ? E.fail(
            new DocumentNotFoundError({
              collection: CollectionName.Accounts,
              filter,
            }),
          )
        : E.succeed(result),
    ),
    E.tap(() => ctx.cache.accounts.delete(_id)),
  );
}

export function setPublicKey(
  ctx: AppBindings,
  _id: Did,
  publicKey: string,
): E.Effect<
  UpdateResult,
  DocumentNotFoundError | CollectionNotFoundError | DatabaseError
> {
  const filter: StrictFilter<OrganizationAccountDocument> = {
    _id,
    _role: "organization",
  };
  const update: StrictUpdateFilter<OrganizationAccountDocument> = {
    $set: { publicKey },
  };

  return pipe(
    checkCollectionExists<OrganizationAccountDocument>(
      ctx,
      "primary",
      CollectionName.Accounts,
    ),
    E.tryMapPromise({
      try: (collection) => collection.updateOne(filter, update),
      catch: (cause) => new DatabaseError({ cause, message: "setPublicKey" }),
    }),
    E.flatMap((result) =>
      result === null
        ? E.fail(
            new DocumentNotFoundError({
              collection: CollectionName.Accounts,
              filter,
            }),
          )
        : E.succeed(result),
    ),
  );
}
