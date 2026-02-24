import * as BuildersRepository from "@nildb/builders/builders.repository";
import type { BuilderDocument, BuilderStatus } from "@nildb/builders/builders.types";
import {
  type CollectionNotFoundError,
  type DatabaseError,
  type DocumentNotFoundError,
  type DuplicateEntryError,
  type PaymentAlreadyProcessedError,
  PaymentValidationError,
} from "@nildb/common/errors";
import type { AppBindings } from "@nildb/env";
import { Effect as E, pipe } from "effect";
import { ObjectId } from "mongodb";

import { computeDigest, getNilUsdPriceHttp, KnownChains, unilsToUsd } from "@nillion/nilpay-client";

import * as CreditsRepository from "./credits.repository";
import type {
  AddRevocationCommand,
  PaymentDocument,
  RegisterCreditsCommand,
  RevocationDocument,
} from "./credits.types";
import { getChainConfigFromEnv, validatePaymentOnChain, verifyDidMatchesPayer } from "./ethereum.services";

/**
 * Register credits from a payment transaction.
 */
export function registerCredits(
  ctx: AppBindings,
  builderDid: string,
  command: RegisterCreditsCommand,
): E.Effect<
  { creditsUsd: number; status: BuilderStatus },
  | PaymentValidationError
  | PaymentAlreadyProcessedError
  | DocumentNotFoundError
  | CollectionNotFoundError
  | DatabaseError
> {
  const { config } = ctx;

  // Verify the payment is for this node
  if (command.nodePublicKey !== ctx.node.publicKey) {
    return E.fail(
      new PaymentValidationError({
        message: `Payment is for node ${command.nodePublicKey}, but this node is ${ctx.node.publicKey}`,
      }),
    );
  }

  // Verify chain is supported
  const supportedChainIds = config.supportedChainIds?.split(",").map((s) => Number.parseInt(s.trim(), 10)) ?? [];
  if (supportedChainIds.length > 0 && !supportedChainIds.includes(command.chainId)) {
    return E.fail(
      new PaymentValidationError({
        message: `Chain ${command.chainId} is not supported. Supported chains: ${supportedChainIds.join(", ")}`,
      }),
    );
  }

  // Compute expected digest
  const expectedDigest = computeDigest({
    nodePublicKey: command.nodePublicKey,
    payerDid: command.payerDid,
    amountUnils: command.amountUnils,
    nonce: command.nonce,
    timestamp: command.timestamp,
    chainId: command.chainId,
  });

  // Check if on-chain validation is configured
  const chainConfig = getChainConfigFromEnv(ctx, command.chainId);
  const shouldValidateOnChain = chainConfig !== null;

  // Validate on-chain if configured
  const validationEffect = shouldValidateOnChain
    ? pipe(
        validatePaymentOnChain(ctx, command.txHash as `0x${string}`, command),
        E.flatMap((result) => {
          // Verify the payer DID matches the on-chain payer
          if (!verifyDidMatchesPayer(command.payerDid, result.payer)) {
            return E.fail(
              new PaymentValidationError({
                message: `Payer DID ${command.payerDid} does not match on-chain payer ${result.payer}`,
              }),
            );
          }
          return E.succeed(result.amountUnils);
        }),
      )
    : E.succeed(command.amountUnils);

  return pipe(
    validationEffect,
    E.flatMap((amountUnils) =>
      pipe(
        fetchNilUsdPrice(ctx),
        E.map((nilUsdPrice) => ({ amountUnils, nilUsdPrice })),
      ),
    ),
    E.flatMap(({ amountUnils, nilUsdPrice }) => {
      const amountUsd = unilsToUsd(amountUnils, nilUsdPrice);

      const now = new Date();
      const paymentDoc: PaymentDocument = {
        _id: new ObjectId(),
        _created: now,
        _updated: now,
        txHash: command.txHash,
        chainId: command.chainId,
        payerDid: command.payerDid,
        amountUnils: amountUnils.toString(),
        amountUsd,
        digest: expectedDigest,
        nodePublicKey: command.nodePublicKey,
        processedAt: now,
      };

      return pipe(
        // Insert payment (will fail if already processed)
        CreditsRepository.insertPayment(ctx, paymentDoc),
        // Add credits and activate builder in a single update
        E.flatMap(() => BuildersRepository.applyCreditsAndActivate(ctx, builderDid, amountUsd)),
        // Return updated balance and status
        E.flatMap(() => BuildersRepository.findOne(ctx, builderDid)),
        E.map((builder) => ({
          creditsUsd: builder.creditsUsd ?? 0,
          status: builder.status ?? "free_tier",
        })),
      );
    }),
  );
}

/**
 * Get credit balance for a builder.
 */
export function getBalance(
  ctx: AppBindings,
  builderDid: string,
): E.Effect<
  { creditsUsd: number; status: BuilderStatus; storageBytes: number; estimatedHoursRemaining: number | null },
  DocumentNotFoundError | CollectionNotFoundError | DatabaseError
> {
  return pipe(
    BuildersRepository.findOne(ctx, builderDid),
    E.map((builder) => {
      const creditsUsd = builder.creditsUsd ?? 0;
      const storageBytes = builder.storageBytes ?? 0;
      const status = computeStatus(builder, ctx.config);

      // Calculate estimated hours remaining
      let estimatedHoursRemaining: number | null = null;
      if (creditsUsd > 0 && storageBytes > ctx.config.freeTierBytes) {
        const billableBytes = storageBytes - ctx.config.freeTierBytes;
        const billableGb = billableBytes / (1024 * 1024 * 1024);
        const costPerHour = billableGb * ctx.config.storageCostPerGbHour;
        if (costPerHour > 0) {
          estimatedHoursRemaining = creditsUsd / costPerHour;
        }
      }

      return {
        creditsUsd,
        status,
        storageBytes,
        estimatedHoursRemaining,
      };
    }),
  );
}

/**
 * Get pricing information.
 */
export function getPricing(ctx: AppBindings): E.Effect<
  {
    storageCostPerGbHour: number;
    freeTierBytes: number;
    supportedChainIds: number[];
    nilUsdPrice: number | null;
    chains: { chainId: number; nilTokenAddress: string; burnContractAddress: string }[];
  },
  never
> {
  const { config } = ctx;

  const supportedChainIds =
    config.supportedChainIds
      ?.split(",")
      .map((s) => Number.parseInt(s.trim(), 10))
      .filter(Boolean) ?? [];

  const chains = supportedChainIds
    .map((chainId) => {
      const known = KnownChains[chainId];
      if (!known) return null;
      return {
        chainId: known.chainId,
        nilTokenAddress: known.nilTokenAddress,
        burnContractAddress: known.burnContractAddress,
      };
    })
    .filter((c) => c !== null);

  return pipe(
    fetchNilUsdPrice(ctx),
    E.catchAll(() => E.succeed(null as number | null)),
    E.map((nilUsdPrice) => ({
      storageCostPerGbHour: config.storageCostPerGbHour,
      freeTierBytes: config.freeTierBytes,
      supportedChainIds,
      nilUsdPrice,
      chains,
    })),
  );
}

/**
 * Fetch the current NIL/USD price from the configured exchange API.
 * Fails if the API URL or coin ID is not configured.
 */
function fetchNilUsdPrice(ctx: AppBindings): E.Effect<number, PaymentValidationError> {
  const { nilUsdExchangeApiUrl, nilUsdExchangeCoinId } = ctx.config;

  if (!nilUsdExchangeApiUrl || !nilUsdExchangeCoinId) {
    return E.fail(
      new PaymentValidationError({
        message: "Exchange API not configured: nilUsdExchangeApiUrl and nilUsdExchangeCoinId are required",
      }),
    );
  }

  return E.tryPromise({
    try: () => getNilUsdPriceHttp(nilUsdExchangeApiUrl, nilUsdExchangeCoinId, ctx.config.nilUsdExchangeApiKey),
    catch: (cause) =>
      new PaymentValidationError({
        message: `Failed to fetch NIL/USD price: ${cause instanceof Error ? cause.message : String(cause)}`,
      }),
  }).pipe(E.map((rate) => rate.nilUsdPrice));
}

/**
 * Compute the builder status based on their current state.
 */
export function computeStatus(
  builder: BuilderDocument,
  config: { freeTierBytes: number; gracePeriodDays: number },
): BuilderStatus {
  const storageBytes = builder.storageBytes ?? 0;
  const creditsUsd = builder.creditsUsd ?? 0;
  const creditsDepleted = builder.creditsDepleted;

  // Free tier: storage is under the limit
  if (storageBytes <= config.freeTierBytes) {
    return "free_tier";
  }

  // Has credits: active
  if (creditsUsd > 0) {
    return "active";
  }

  // No credits - graduated degradation based on time
  if (!creditsDepleted) {
    // Just ran out of credits
    return "warning";
  }

  const hoursWithoutCredits = (Date.now() - creditsDepleted.getTime()) / (1000 * 60 * 60);

  // 0-72 hours: warning
  if (hoursWithoutCredits < 72) {
    return "warning";
  }

  // 72 hours to 1 week: read-only
  if (hoursWithoutCredits < 168) {
    return "read_only";
  }

  // 1 week to grace period: suspended
  const gracePeriodHours = config.gracePeriodDays * 24;
  if (hoursWithoutCredits < gracePeriodHours) {
    return "suspended";
  }

  // Beyond grace period: pending purge
  return "pending_purge";
}

/**
 * Get payment history for a builder.
 */
export function getPaymentHistory(
  ctx: AppBindings,
  builderDid: string,
  limit: number,
  offset: number,
): E.Effect<
  { data: PaymentDocument[]; total: number; limit: number; offset: number },
  CollectionNotFoundError | DatabaseError
> {
  return pipe(
    CreditsRepository.findPaymentsByPayer(ctx, builderDid, limit, offset),
    E.map(({ data, total }) => ({ data, total, limit, offset })),
  );
}

/**
 * Add a token revocation.
 */
export function addRevocation(
  ctx: AppBindings,
  command: AddRevocationCommand,
): E.Effect<void, DuplicateEntryError | CollectionNotFoundError | DatabaseError> {
  const now = new Date();
  const doc: RevocationDocument = {
    _id: new ObjectId(),
    _created: now,
    tokenHash: command.tokenHash,
    revokedBy: command.revokedBy,
    expiresAt: command.expiresAt,
  };

  return CreditsRepository.insertRevocation(ctx, doc);
}

/**
 * Check if any tokens in the list are revoked.
 */
export function checkRevocations(
  ctx: AppBindings,
  tokenHashes: string[],
): E.Effect<string[], CollectionNotFoundError | DatabaseError> {
  return pipe(
    CreditsRepository.findRevocationsByTokenHashes(ctx, tokenHashes),
    E.map((revocations) => revocations.map((r) => r.tokenHash)),
  );
}
