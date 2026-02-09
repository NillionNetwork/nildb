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

import { computeDigest, KnownChains, unilsToUsd } from "@nillion/nilpay-client";

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

  // Use a placeholder exchange rate.
  // In production, this would be fetched from the oracle.
  const nilUsdPrice = 0.1; // Placeholder: $0.10 per NIL

  return pipe(
    validationEffect,
    E.flatMap((amountUnils) => {
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
        // Add credits to builder
        E.flatMap(() => BuildersRepository.addCreditsUsd(ctx, builderDid, amountUsd)),
        // Update status to active
        E.flatMap(() => BuildersRepository.updateStatus(ctx, builderDid, "active", null)),
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
export function getPricing(ctx: AppBindings): {
  storageCostPerGbHour: number;
  freeTierBytes: number;
  supportedChainIds: number[];
  nilUsdPrice: number | null;
  chains: { chainId: number; nilTokenAddress: string; burnContractAddress: string }[];
} {
  const { config } = ctx;

  const supportedChainIds =
    config.supportedChainIds
      ?.split(",")
      .map((s) => Number.parseInt(s.trim(), 10))
      .filter(Boolean) ?? [];

  // Placeholder - in production this would be fetched from the oracle
  const nilUsdPrice: number | null = 0.1;

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

  return {
    storageCostPerGbHour: config.storageCostPerGbHour,
    freeTierBytes: config.freeTierBytes,
    supportedChainIds,
    nilUsdPrice,
    chains,
  };
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
