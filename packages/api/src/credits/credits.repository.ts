import {
  type CollectionNotFoundError,
  DatabaseError,
  DuplicateEntryError,
  PaymentAlreadyProcessedError,
} from "@nildb/common/errors";
import { checkCollectionExists, CollectionName, MongoErrorCode } from "@nildb/common/mongo";
import type { AppBindings } from "@nildb/env";
import { Effect as E, pipe } from "effect";
import { MongoServerError, type StrictFilter } from "mongodb";

import type { PaymentDocument, RevocationDocument } from "./credits.types.js";

/**
 * Insert a payment document.
 */
export function insertPayment(
  ctx: AppBindings,
  document: PaymentDocument,
): E.Effect<void, PaymentAlreadyProcessedError | CollectionNotFoundError | DatabaseError> {
  return pipe(
    checkCollectionExists<PaymentDocument>(ctx, "primary", CollectionName.Payments),
    E.tryMapPromise({
      try: (collection) => collection.insertOne(document),
      catch: (cause) => {
        if (cause instanceof MongoServerError && cause.code === MongoErrorCode.Duplicate) {
          return new PaymentAlreadyProcessedError({
            txHash: document.txHash,
            chainId: document.chainId,
          });
        }
        return new DatabaseError({ cause, message: "insertPayment" });
      },
    }),
    E.as(void 0),
  );
}

/**
 * Find a payment by transaction hash and chain ID.
 */
export function findPaymentByTxHashAndChain(
  ctx: AppBindings,
  txHash: string,
  chainId: number,
): E.Effect<PaymentDocument | null, CollectionNotFoundError | DatabaseError> {
  const filter: StrictFilter<PaymentDocument> = { txHash, chainId };

  return pipe(
    checkCollectionExists<PaymentDocument>(ctx, "primary", CollectionName.Payments),
    E.tryMapPromise({
      try: (collection) => collection.findOne(filter),
      catch: (cause) => new DatabaseError({ cause, message: "findPaymentByTxHashAndChain" }),
    }),
  );
}

/**
 * Insert a revocation document.
 */
export function insertRevocation(
  ctx: AppBindings,
  document: RevocationDocument,
): E.Effect<void, DuplicateEntryError | CollectionNotFoundError | DatabaseError> {
  return pipe(
    checkCollectionExists<RevocationDocument>(ctx, "primary", CollectionName.Revocations),
    E.tryMapPromise({
      try: (collection) => collection.insertOne(document),
      catch: (cause) => {
        if (cause instanceof MongoServerError && cause.code === MongoErrorCode.Duplicate) {
          return new DuplicateEntryError({
            document: { tokenHash: document.tokenHash },
          });
        }
        return new DatabaseError({ cause, message: "insertRevocation" });
      },
    }),
    E.as(void 0),
  );
}

/**
 * Find a revocation by token hash.
 */
export function findRevocationByTokenHash(
  ctx: AppBindings,
  tokenHash: string,
): E.Effect<RevocationDocument | null, CollectionNotFoundError | DatabaseError> {
  const filter: StrictFilter<RevocationDocument> = { tokenHash };

  return pipe(
    checkCollectionExists<RevocationDocument>(ctx, "primary", CollectionName.Revocations),
    E.tryMapPromise({
      try: (collection) => collection.findOne(filter),
      catch: (cause) => new DatabaseError({ cause, message: "findRevocationByTokenHash" }),
    }),
  );
}

/**
 * Find multiple revocations by token hashes.
 */
export function findRevocationsByTokenHashes(
  ctx: AppBindings,
  tokenHashes: string[],
): E.Effect<RevocationDocument[], CollectionNotFoundError | DatabaseError> {
  if (tokenHashes.length === 0) {
    return E.succeed([]);
  }

  const filter = { tokenHash: { $in: tokenHashes } };

  return pipe(
    checkCollectionExists<RevocationDocument>(ctx, "primary", CollectionName.Revocations),
    E.tryMapPromise({
      try: (collection) => collection.find(filter).toArray(),
      catch: (cause) => new DatabaseError({ cause, message: "findRevocationsByTokenHashes" }),
    }),
  );
}

/**
 * Delete expired revocations (manual cleanup if TTL index doesn't work).
 */
export function deleteExpiredRevocations(ctx: AppBindings): E.Effect<number, CollectionNotFoundError | DatabaseError> {
  const filter = { expiresAt: { $lt: new Date() } };

  return pipe(
    checkCollectionExists<RevocationDocument>(ctx, "primary", CollectionName.Revocations),
    E.tryMapPromise({
      try: (collection) => collection.deleteMany(filter),
      catch: (cause) => new DatabaseError({ cause, message: "deleteExpiredRevocations" }),
    }),
    E.map((result) => result.deletedCount),
  );
}
