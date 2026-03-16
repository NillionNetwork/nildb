import {
  type CollectionNotFoundError,
  DatabaseError,
  DocumentNotFoundError,
  DuplicateEntryError,
} from "@nildb/common/errors";
import { CollectionName, checkCollectionExists, MongoErrorCode } from "@nildb/common/mongo";
import type { AppBindings } from "@nildb/env";
import { Effect as E, pipe } from "effect";
import { MongoServerError, type StrictFilter, type StrictUpdateFilter, type UpdateResult, type UUID } from "mongodb";

import type { BuilderDocument, BuilderStatus } from "./builders.types";

/**
 * Insert builder document.
 */
export function insert(
  ctx: AppBindings,
  document: BuilderDocument,
): E.Effect<void, DuplicateEntryError | CollectionNotFoundError | DatabaseError> {
  return pipe(
    checkCollectionExists<BuilderDocument>(ctx, "primary", CollectionName.Builders),
    E.tryMapPromise({
      try: (collection) => collection.insertOne(document),
      catch: (cause) => {
        if (cause instanceof MongoServerError && cause.code === MongoErrorCode.Duplicate) {
          return new DuplicateEntryError({
            document: {
              did: document.did,
            },
          });
        }
        return new DatabaseError({ cause, message: "insert" });
      },
    }),
    E.as(void 0),
  );
}

/**
 * Find all builders with optional search and pagination.
 */
export function findAll(
  ctx: AppBindings,
  search: string | undefined,
  limit: number,
  offset: number,
): E.Effect<{ data: BuilderDocument[]; total: number; unmigrated: number }, CollectionNotFoundError | DatabaseError> {
  const filter: Record<string, unknown> = {};
  if (search) {
    const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    filter.$or = [{ did: { $regex: escaped, $options: "i" } }, { name: { $regex: escaped, $options: "i" } }];
  }

  return pipe(
    checkCollectionExists<BuilderDocument>(ctx, "primary", CollectionName.Builders),
    E.flatMap((collection) =>
      E.all([
        E.tryPromise({
          try: () => collection.find(filter).sort({ _created: -1 }).skip(offset).limit(limit).toArray(),
          catch: (cause) => new DatabaseError({ cause, message: "findAll" }),
        }),
        E.tryPromise({
          try: () => collection.countDocuments(filter),
          catch: (cause) => new DatabaseError({ cause, message: "findAll:count" }),
        }),
        E.tryPromise({
          try: () => collection.countDocuments({ creditsUsd: { $exists: false } }),
          catch: (cause) => new DatabaseError({ cause, message: "findAll:unmigrated" }),
        }),
      ]),
    ),
    E.map(([data, total, unmigrated]) => ({ data, total, unmigrated })),
  );
}

/**
 * Find builder by ID with cache.
 */
export function findByIdWithCache(
  ctx: AppBindings,
  builder: string,
): E.Effect<BuilderDocument, DocumentNotFoundError | CollectionNotFoundError | DatabaseError> {
  const cache = ctx.cache.builders;
  const document = cache.get(builder);
  if (document) {
    return E.succeed(document);
  }

  const filter = { did: builder };

  return pipe(
    checkCollectionExists<BuilderDocument>(ctx, "primary", CollectionName.Builders),
    E.tryMapPromise({
      try: (collection) => collection.findOne(filter),
      catch: (cause) => new DatabaseError({ cause, message: "findByIdWithCache" }),
    }),
    E.flatMap((result) =>
      result === null
        ? E.fail(
            new DocumentNotFoundError({
              collection: CollectionName.Builders,
              filter,
            }),
          )
        : E.succeed(result),
    ),
    E.tap((document) => cache.set(builder, document)),
  );
}

/**
 * Find builder by ID.
 */
export function findOne(
  ctx: AppBindings,
  builder: string,
): E.Effect<BuilderDocument, DocumentNotFoundError | CollectionNotFoundError | DatabaseError> {
  const filter: StrictFilter<BuilderDocument> = { did: builder };

  return pipe(
    checkCollectionExists<BuilderDocument>(ctx, "primary", CollectionName.Builders),
    E.tryMapPromise({
      try: (collection) => collection.findOne(filter),
      catch: (cause) => new DatabaseError({ cause, message: "findOne" }),
    }),
    E.flatMap((result) =>
      result === null
        ? E.fail(
            new DocumentNotFoundError({
              collection: CollectionName.Builders,
              filter,
            }),
          )
        : E.succeed(result),
    ),
  );
}

/**
 * Delete builder by ID.
 */
export function deleteOneById(
  ctx: AppBindings,
  builder: string,
): E.Effect<void, DocumentNotFoundError | CollectionNotFoundError | DatabaseError> {
  const filter: StrictFilter<BuilderDocument> = { did: builder };

  return pipe(
    checkCollectionExists<BuilderDocument>(ctx, "primary", CollectionName.Builders),
    E.tryMapPromise({
      try: (collection) => collection.deleteOne(filter),
      catch: (cause) => new DatabaseError({ cause, message: "deleteOneById" }),
    }),
    E.flatMap((result) =>
      result === null
        ? E.fail(
            new DocumentNotFoundError({
              collection: CollectionName.Builders,
              filter,
            }),
          )
        : E.succeed(result),
    ),
    E.tap(() => ctx.cache.builders.delete(builder)),
  );
}

/**
 * Update builder fields.
 */
export function update(
  ctx: AppBindings,
  builder: string,
  updates: Partial<{ _updated: Date; name: string }>,
): E.Effect<UpdateResult, DocumentNotFoundError | CollectionNotFoundError | DatabaseError> {
  const filter: StrictFilter<BuilderDocument> = { did: builder };

  const update: StrictUpdateFilter<BuilderDocument> = {
    $set: {
      ...(updates._updated && { _updated: updates._updated }),
      ...(updates.name && { name: updates.name }),
    },
  };

  return pipe(
    checkCollectionExists<BuilderDocument>(ctx, "primary", CollectionName.Builders),
    E.tryMapPromise({
      try: (collection) => collection.updateOne(filter, update),
      catch: (cause) => new DatabaseError({ cause, message: "setPublicKey" }),
    }),
    E.flatMap((result) =>
      result === null
        ? E.fail(
            new DocumentNotFoundError({
              collection: CollectionName.Builders,
              filter,
            }),
          )
        : E.succeed(result),
    ),
  );
}

/**
 * Add collection to builder.
 */
export function addCollection(
  ctx: AppBindings,
  builder: string,
  collection: UUID,
): E.Effect<void, DocumentNotFoundError | CollectionNotFoundError | DatabaseError> {
  const filter: StrictFilter<BuilderDocument> = { did: builder };

  const update: StrictUpdateFilter<BuilderDocument> = {
    $addToSet: { collections: collection },
  };

  return pipe(
    checkCollectionExists<BuilderDocument>(ctx, "primary", CollectionName.Builders),
    E.tryMapPromise({
      try: (collection) => collection.updateOne(filter, update),
      catch: (cause) => new DatabaseError({ cause, message: "addCollection" }),
    }),
    E.flatMap((result) =>
      result.modifiedCount === 1
        ? E.succeed(void 0)
        : E.fail(
            new DocumentNotFoundError({
              collection: CollectionName.Builders,
              filter,
            }),
          ),
    ),
  );
}

/**
 * Remove collection from builder.
 */
export function removeCollection(
  ctx: AppBindings,
  builder: string,
  collection: UUID,
): E.Effect<void, DocumentNotFoundError | CollectionNotFoundError | DatabaseError> {
  const filter: StrictFilter<BuilderDocument> = { did: builder };

  const update: StrictUpdateFilter<BuilderDocument> = {
    $pull: { collections: collection },
  };

  return pipe(
    checkCollectionExists<BuilderDocument>(ctx, "primary", CollectionName.Builders),
    E.tryMapPromise({
      try: (collection) => collection.updateOne(filter, update),
      catch: (cause) => new DatabaseError({ cause, message: "removeCollection" }),
    }),
    E.flatMap((result) =>
      result.modifiedCount === 1
        ? E.succeed(void 0)
        : E.fail(
            new DocumentNotFoundError({
              collection: CollectionName.Builders,
              filter,
            }),
          ),
    ),
  );
}

/**
 * Add query to builder.
 */
export function addQuery(
  ctx: AppBindings,
  builder: string,
  query: UUID,
): E.Effect<void, DocumentNotFoundError | CollectionNotFoundError | DatabaseError> {
  const filter: StrictFilter<BuilderDocument> = { did: builder };
  const update: StrictUpdateFilter<BuilderDocument> = {
    $addToSet: { queries: query },
  };

  return pipe(
    checkCollectionExists<BuilderDocument>(ctx, "primary", CollectionName.Builders),
    E.tryMapPromise({
      try: (collection) => collection.updateOne(filter, update),
      catch: (cause) => new DatabaseError({ cause, message: "addQuery" }),
    }),
    E.flatMap((result) =>
      result.modifiedCount === 1
        ? E.succeed(void 0)
        : E.fail(
            new DocumentNotFoundError({
              collection: CollectionName.Builders,
              filter,
            }),
          ),
    ),
  );
}

/**
 * Remove query from builder.
 */
export function removeQuery(
  ctx: AppBindings,
  builder: string,
  query: UUID,
): E.Effect<void, DocumentNotFoundError | CollectionNotFoundError | DatabaseError> {
  const filter: StrictFilter<BuilderDocument> = { did: builder };

  const update: StrictUpdateFilter<BuilderDocument> = {
    $pull: { queries: query },
  };

  return pipe(
    checkCollectionExists<BuilderDocument>(ctx, "primary", CollectionName.Builders),
    E.tryMapPromise({
      try: (collection) => collection.updateOne(filter, update),
      catch: (cause) => new DatabaseError({ cause, message: "removeQuery" }),
    }),
    E.flatMap((result) =>
      result.modifiedCount === 1
        ? E.succeed(void 0)
        : E.fail(
            new DocumentNotFoundError({
              collection: CollectionName.Builders,
              filter,
            }),
          ),
    ),
  );
}

/**
 * Add credits (in USD) to a builder's balance.
 */
export function addCreditsUsd(
  ctx: AppBindings,
  builder: string,
  amountUsd: number,
): E.Effect<void, DocumentNotFoundError | CollectionNotFoundError | DatabaseError> {
  const filter: StrictFilter<BuilderDocument> = { did: builder };

  return pipe(
    checkCollectionExists<BuilderDocument>(ctx, "primary", CollectionName.Builders),
    E.tryMapPromise({
      try: (collection) =>
        collection.updateOne(filter, {
          $inc: { creditsUsd: amountUsd },
          $set: {
            _updated: new Date(),
            lastCreditTopUp: new Date(),
            creditsDepleted: null,
          },
        }),
      catch: (cause) => new DatabaseError({ cause, message: "addCreditsUsd" }),
    }),
    E.flatMap((result) =>
      result.matchedCount === 1
        ? E.succeed(void 0)
        : E.fail(
            new DocumentNotFoundError({
              collection: CollectionName.Builders,
              filter,
            }),
          ),
    ),
    E.tap(() => ctx.cache.builders.delete(builder)),
  );
}

/**
 * Atomically add credits and set status to active in a single update.
 * Combines the addCreditsUsd + updateStatus operations to reduce partial failure risk.
 */
export function applyCreditsAndActivate(
  ctx: AppBindings,
  builder: string,
  amountUsd: number,
): E.Effect<void, DocumentNotFoundError | CollectionNotFoundError | DatabaseError> {
  const filter: StrictFilter<BuilderDocument> = { did: builder };
  const now = new Date();

  return pipe(
    checkCollectionExists<BuilderDocument>(ctx, "primary", CollectionName.Builders),
    E.tryMapPromise({
      try: (collection) =>
        collection.updateOne(filter, {
          $inc: { creditsUsd: amountUsd },
          $set: {
            status: "active",
            _updated: now,
            lastCreditTopUp: now,
            creditsDepleted: null,
          },
        }),
      catch: (cause) => new DatabaseError({ cause, message: "applyCreditsAndActivate" }),
    }),
    E.flatMap((result) =>
      result.matchedCount === 1
        ? E.succeed(void 0)
        : E.fail(
            new DocumentNotFoundError({
              collection: CollectionName.Builders,
              filter,
            }),
          ),
    ),
    E.tap(() => ctx.cache.builders.delete(builder)),
  );
}

/**
 * Deduct credits (in USD) from a builder's balance.
 * Credits cannot go below 0.
 */
export function deductCreditsUsd(
  ctx: AppBindings,
  builder: string,
  amountUsd: number,
): E.Effect<
  { newBalance: number; depleted: boolean },
  DocumentNotFoundError | CollectionNotFoundError | DatabaseError
> {
  const filter: StrictFilter<BuilderDocument> = { did: builder };

  return pipe(
    checkCollectionExists<BuilderDocument>(ctx, "primary", CollectionName.Builders),
    E.tryMapPromise({
      try: async (collection) => {
        // Use findOneAndUpdate with $max to prevent negative balance
        const result = await collection.findOneAndUpdate(
          filter,
          [
            {
              $set: {
                creditsUsd: { $max: [{ $subtract: [{ $ifNull: ["$creditsUsd", 0] }, amountUsd] }, 0] },
                _updated: new Date(),
              },
            },
          ],
          { returnDocument: "after" },
        );
        return result;
      },
      catch: (cause) => new DatabaseError({ cause, message: "deductCreditsUsd" }),
    }),
    E.flatMap((result) =>
      result === null
        ? E.fail(
            new DocumentNotFoundError({
              collection: CollectionName.Builders,
              filter,
            }),
          )
        : E.succeed({
            newBalance: result.creditsUsd ?? 0,
            depleted: (result.creditsUsd ?? 0) <= 0,
          }),
    ),
    E.tap(() => ctx.cache.builders.delete(builder)),
  );
}

/**
 * Update builder status.
 */
export function updateStatus(
  ctx: AppBindings,
  builder: string,
  status: BuilderStatus,
  creditsDepleted?: Date | null,
): E.Effect<void, DocumentNotFoundError | CollectionNotFoundError | DatabaseError> {
  const filter: StrictFilter<BuilderDocument> = { did: builder };

  const setFields: Record<string, unknown> = {
    status,
    _updated: new Date(),
  };

  if (creditsDepleted !== undefined) {
    setFields.creditsDepleted = creditsDepleted;
  }

  return pipe(
    checkCollectionExists<BuilderDocument>(ctx, "primary", CollectionName.Builders),
    E.tryMapPromise({
      try: (collection) => collection.updateOne(filter, { $set: setFields }),
      catch: (cause) => new DatabaseError({ cause, message: "updateStatus" }),
    }),
    E.flatMap((result) =>
      result.matchedCount === 1
        ? E.succeed(void 0)
        : E.fail(
            new DocumentNotFoundError({
              collection: CollectionName.Builders,
              filter,
            }),
          ),
    ),
    E.tap(() => ctx.cache.builders.delete(builder)),
  );
}

/**
 * Update storage snapshot for billing.
 */
export function updateStorageSnapshot(
  ctx: AppBindings,
  builder: string,
  storageBytes: number,
  billingTime: Date,
): E.Effect<void, DocumentNotFoundError | CollectionNotFoundError | DatabaseError> {
  const filter: StrictFilter<BuilderDocument> = { did: builder };

  return pipe(
    checkCollectionExists<BuilderDocument>(ctx, "primary", CollectionName.Builders),
    E.tryMapPromise({
      try: (collection) =>
        collection.updateOne(filter, {
          $set: {
            storageBytes,
            lastBillingCycle: billingTime,
            _updated: new Date(),
          },
        }),
      catch: (cause) => new DatabaseError({ cause, message: "updateStorageSnapshot" }),
    }),
    E.flatMap((result) =>
      result.matchedCount === 1
        ? E.succeed(void 0)
        : E.fail(
            new DocumentNotFoundError({
              collection: CollectionName.Builders,
              filter,
            }),
          ),
    ),
    E.tap(() => ctx.cache.builders.delete(builder)),
  );
}

/**
 * Find builders that need billing (last billed before a certain time).
 */
export function findBuildersForBilling(
  ctx: AppBindings,
  lastBilledBefore: Date,
  limit: number,
): E.Effect<BuilderDocument[], CollectionNotFoundError | DatabaseError> {
  // Find builders with credits enabled (have creditsUsd field) and need billing
  const filter = {
    creditsUsd: { $exists: true },
    $or: [{ lastBillingCycle: { $lt: lastBilledBefore } }, { lastBillingCycle: { $exists: false } }],
  };

  return pipe(
    checkCollectionExists<BuilderDocument>(ctx, "primary", CollectionName.Builders),
    E.tryMapPromise({
      try: (collection) => collection.find(filter).limit(limit).toArray(),
      catch: (cause) => new DatabaseError({ cause, message: "findBuildersForBilling" }),
    }),
  );
}

/**
 * Find builders pending purge.
 */
export function findBuildersPendingPurge(
  ctx: AppBindings,
  creditsDepletesBefore: Date,
  limit: number,
): E.Effect<BuilderDocument[], CollectionNotFoundError | DatabaseError> {
  const filter: StrictFilter<BuilderDocument> = {
    status: "pending_purge",
    creditsDepleted: { $lt: creditsDepletesBefore },
  };

  return pipe(
    checkCollectionExists<BuilderDocument>(ctx, "primary", CollectionName.Builders),
    E.tryMapPromise({
      try: (collection) => collection.find(filter).limit(limit).toArray(),
      catch: (cause) => new DatabaseError({ cause, message: "findBuildersPendingPurge" }),
    }),
  );
}

/**
 * Find builders that have not been migrated to the credit system.
 */
export function findUnmigrated(ctx: AppBindings): E.Effect<BuilderDocument[], CollectionNotFoundError | DatabaseError> {
  return pipe(
    checkCollectionExists<BuilderDocument>(ctx, "primary", CollectionName.Builders),
    E.tryMapPromise({
      try: (collection) => collection.find({ creditsUsd: { $exists: false } }).toArray(),
      catch: (cause) => new DatabaseError({ cause, message: "findUnmigrated" }),
    }),
  );
}

/**
 * Migrate specific builders to the credit system by setting credit fields.
 */
export function migrateToCredits(
  ctx: AppBindings,
  dids: string[],
  creditsUsd: number,
  now: Date,
): E.Effect<void, CollectionNotFoundError | DatabaseError> {
  return pipe(
    checkCollectionExists<BuilderDocument>(ctx, "primary", CollectionName.Builders),
    E.tryMapPromise({
      try: (collection) =>
        collection.updateMany(
          { did: { $in: dids } },
          {
            $set: {
              creditsUsd,
              status: "active" as BuilderStatus,
              lastCreditTopUp: now,
              creditsDepleted: null,
              _updated: now,
            },
          },
        ),
      catch: (cause) => new DatabaseError({ cause, message: "migrateToCredits" }),
    }),
    E.as(void 0),
  );
}
