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

import type { AdminCreditGrantDocument, PaymentDocument, RevocationDocument } from "./credits.types";

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
 * Find payments by payer DID with pagination.
 */
export function findPaymentsByPayer(
  ctx: AppBindings,
  payerDid: string,
  limit: number,
  offset: number,
): E.Effect<{ data: PaymentDocument[]; total: number }, CollectionNotFoundError | DatabaseError> {
  const filter: StrictFilter<PaymentDocument> = { payerDid };

  return pipe(
    checkCollectionExists<PaymentDocument>(ctx, "primary", CollectionName.Payments),
    E.flatMap((collection) =>
      E.all([
        E.tryPromise({
          try: () => collection.find(filter).sort({ processedAt: -1 }).skip(offset).limit(limit).toArray(),
          catch: (cause) => new DatabaseError({ cause, message: "findPaymentsByPayer" }),
        }),
        E.tryPromise({
          try: () => collection.countDocuments(filter),
          catch: (cause) => new DatabaseError({ cause, message: "findPaymentsByPayer:count" }),
        }),
      ]),
    ),
    E.map(([data, total]) => ({ data, total })),
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
 * Insert an admin credit grant document.
 */
export function insertAdminCreditGrant(
  ctx: AppBindings,
  document: AdminCreditGrantDocument,
): E.Effect<void, CollectionNotFoundError | DatabaseError> {
  return pipe(
    checkCollectionExists<AdminCreditGrantDocument>(ctx, "primary", CollectionName.AdminCreditGrants),
    E.tryMapPromise({
      try: (collection) => collection.insertOne(document),
      catch: (cause) => new DatabaseError({ cause, message: "insertAdminCreditGrant" }),
    }),
    E.as(void 0),
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
