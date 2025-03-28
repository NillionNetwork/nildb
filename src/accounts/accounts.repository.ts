import { Effect as E, pipe } from "effect";
import type { StrictFilter, StrictUpdateFilter, UpdateResult } from "mongodb";
import type { AccountDocument } from "#/admin/admin.types";
import { advance } from "#/common/date";
import {
  DatabaseError,
  DocumentNotFoundError,
  type PrimaryCollectionNotFoundError,
} from "#/common/errors";
import { CollectionName, checkPrimaryCollectionExists } from "#/common/mongo";
import type { Did } from "#/common/types";
import type { AppBindings } from "#/env";
import type {
  AccountSubscriptionDocument,
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
    _type: "organization",
    _created: now,
    _updated: now,
    name,
    subscription: {
      start: now,
      end: advance(now, 365),
      txHash: "",
    },
    schemas: [],
    queries: [],
  };
}

export function insert(
  ctx: AppBindings,
  document: OrganizationAccountDocument,
): E.Effect<void, PrimaryCollectionNotFoundError | DatabaseError> {
  return pipe(
    checkPrimaryCollectionExists<OrganizationAccountDocument>(
      ctx,
      CollectionName.Accounts,
    ),
    E.flatMap((collection) =>
      E.tryPromise({
        try: () => collection.insertOne(document),
        catch: (cause) => new DatabaseError({ cause, message: "insert" }),
      }),
    ),
    E.as(void 0),
  );
}

export function findByIdWithCache(
  ctx: AppBindings,
  _id: Did,
): E.Effect<
  AccountDocument,
  DocumentNotFoundError | PrimaryCollectionNotFoundError | DatabaseError
> {
  const cache = ctx.cache.accounts;
  const account = cache.get(_id);
  if (account) {
    return E.succeed(account);
  }

  const filter = { _id };

  return pipe(
    checkPrimaryCollectionExists<AccountDocument>(ctx, CollectionName.Accounts),
    E.flatMap((collection) =>
      E.tryPromise({
        try: () => collection.findOne(filter),
        catch: (cause) =>
          new DatabaseError({ cause, message: "findByIdWithCache" }),
      }),
    ),
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
  DocumentNotFoundError | PrimaryCollectionNotFoundError | DatabaseError
> {
  const filter: StrictFilter<OrganizationAccountDocument> = {
    _id,
    _type: "organization",
  };
  return pipe(
    checkPrimaryCollectionExists<OrganizationAccountDocument>(
      ctx,
      CollectionName.Accounts,
    ),
    E.flatMap((collection) =>
      E.tryPromise({
        try: () => collection.findOne(filter),
        catch: (cause) =>
          new DatabaseError({ cause, message: "findOneOrganization" }),
      }),
    ),
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
  DocumentNotFoundError | PrimaryCollectionNotFoundError | DatabaseError
> {
  const filter: StrictFilter<OrganizationAccountDocument> = {
    _id,
    _type: "organization",
  };

  return pipe(
    checkPrimaryCollectionExists<OrganizationAccountDocument>(
      ctx,
      CollectionName.Accounts,
    ),
    E.flatMap((collection) =>
      E.tryPromise({
        try: () => collection.deleteOne(filter),
        catch: (cause) =>
          new DatabaseError({ cause, message: "deleteOneById" }),
      }),
    ),
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

export function setSubscriptionState(
  ctx: AppBindings,
  did: Did,
  start: Date,
  end: Date,
  txHash: string,
): E.Effect<
  UpdateResult,
  DocumentNotFoundError | PrimaryCollectionNotFoundError | DatabaseError
> {
  const filter: StrictFilter<OrganizationAccountDocument> = {
    _id: did,
    _type: "organization",
  };
  const update: StrictUpdateFilter<OrganizationAccountDocument> = {
    $set: {
      "subscription.start": start,
      "subscription.end": end,
      "subscription.txHash": txHash,
    },
  };

  return pipe(
    checkPrimaryCollectionExists<OrganizationAccountDocument>(
      ctx,
      CollectionName.Accounts,
    ),
    E.flatMap((collection) =>
      E.tryPromise({
        try: () => collection.updateOne(filter, update),
        catch: (cause) =>
          new DatabaseError({ cause, message: "setSubscriptionState" }),
      }),
    ),
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
    E.tap(() => ctx.cache.accounts.taint(did)),
  );
}

export function getSubscriptionState(
  ctx: AppBindings,
  _id: Did,
): E.Effect<
  AccountSubscriptionDocument,
  DocumentNotFoundError | PrimaryCollectionNotFoundError | DatabaseError
> {
  const now = new Date();
  return pipe(
    findOneOrganization(ctx, _id),
    E.map((document) => {
      const { start, end, txHash } = document.subscription;
      return {
        active: start <= now && end >= now,
        start,
        end,
        txHash,
      };
    }),
  );
}

export function setPublicKey(
  ctx: AppBindings,
  _id: Did,
  publicKey: string,
): E.Effect<
  UpdateResult,
  DocumentNotFoundError | PrimaryCollectionNotFoundError | DatabaseError
> {
  const filter: StrictFilter<OrganizationAccountDocument> = {
    _id,
    _type: "organization",
  };
  const update: StrictUpdateFilter<OrganizationAccountDocument> = {
    $set: { publicKey },
  };

  return pipe(
    checkPrimaryCollectionExists<OrganizationAccountDocument>(
      ctx,
      CollectionName.Accounts,
    ),
    E.flatMap((collection) =>
      E.tryPromise({
        try: () => collection.updateOne(filter, update),
        catch: (cause) => new DatabaseError({ cause, message: "setPublicKey" }),
      }),
    ),
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
