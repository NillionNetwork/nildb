import { Effect as E, pipe } from "effect";
import type { StrictFilter, StrictUpdateFilter, UUID } from "mongodb";
import type { OrganizationAccountDocument } from "#/accounts/accounts.types";
import {
  type CollectionNotFoundError,
  DatabaseError,
  DocumentNotFoundError,
} from "#/common/errors";
import { checkCollectionExists, CollectionName } from "#/common/mongo";
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
  const filter: StrictFilter<OrganizationAccountDocument> = { _id: owner };
  const update: StrictUpdateFilter<OrganizationAccountDocument> = {
    $addToSet: { schemas: schemaId },
  };

  return pipe(
    checkCollectionExists<OrganizationAccountDocument>(
      ctx,
      "primary",
      CollectionName.Accounts,
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
              collection: CollectionName.Accounts,
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
  const filter: StrictFilter<OrganizationAccountDocument> = { _id: orgDid };
  const update: StrictUpdateFilter<OrganizationAccountDocument> = {
    $pull: { schemas: schemaId },
  };

  return pipe(
    checkCollectionExists<OrganizationAccountDocument>(
      ctx,
      "primary",
      CollectionName.Accounts,
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
              collection: CollectionName.Accounts,
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
  const filter: StrictFilter<OrganizationAccountDocument> = { _id: orgId };
  const update: StrictUpdateFilter<OrganizationAccountDocument> = {
    $addToSet: { queries: queryId },
  };

  return pipe(
    checkCollectionExists<OrganizationAccountDocument>(
      ctx,
      "primary",
      CollectionName.Accounts,
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
              collection: CollectionName.Accounts,
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
  const filter: StrictFilter<OrganizationAccountDocument> = { _id: orgId };
  const update: StrictUpdateFilter<OrganizationAccountDocument> = {
    $pull: { queries: queryId },
  };

  return pipe(
    checkCollectionExists<OrganizationAccountDocument>(
      ctx,
      "primary",
      CollectionName.Accounts,
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
              collection: CollectionName.Accounts,
              filter,
            }),
          ),
    ),
  );
}
