import { handleTaggedErrors } from "@nildb/common/handler";
import { OpenApiSpecCommonErrorResponses } from "@nildb/common/openapi";
import type { ControllerOptions } from "@nildb/common/types";
import { FeatureFlag, hasFeatureFlag } from "@nildb/env";
import {
  loadNucToken,
  loadSubjectAndVerifyAsBuilder,
  requireNucNamespace,
} from "@nildb/middleware/capability.middleware";
import { Effect as E, pipe } from "effect";
import { describeRoute, resolver, validator as zValidator } from "hono-openapi";

import {
  NucCmd,
  PaginationQuerySchema,
  PathsV1,
  ReadCreditsResponse,
  ReadPaymentsResponse,
  ReadPricingResponse,
  RegisterCreditsRequest,
  RegisterCreditsResponse,
} from "@nillion/nildb-types";

import { CreditsDataMapper } from "./credits.mapper";
import * as CreditsService from "./credits.services";

/**
 * Handle POST /v1/credits/register
 * Register credits from a payment transaction.
 */
export function registerCredits(options: ControllerOptions): void {
  const { app, bindings } = options;
  const path = PathsV1.credits.register;

  // Only register route if credits feature is enabled
  if (!hasFeatureFlag(bindings.config.enabledFeatures, FeatureFlag.CREDITS)) {
    return;
  }

  app.post(
    path,
    describeRoute({
      tags: ["Credits"],
      security: [{ bearerAuth: [] }],
      summary: "Register credits from payment",
      responses: {
        200: {
          description: "OK",
          content: {
            "application/json": {
              schema: resolver(RegisterCreditsResponse),
            },
          },
        },
        ...OpenApiSpecCommonErrorResponses,
      },
    }),
    zValidator("json", RegisterCreditsRequest),
    loadNucToken(bindings),
    loadSubjectAndVerifyAsBuilder(bindings),
    requireNucNamespace(NucCmd.nil.db.credits.create),
    async (c) => {
      const builder = c.get("builder");
      const payload = c.req.valid("json");
      const command = CreditsDataMapper.toRegisterCreditsCommand(payload);

      return pipe(
        CreditsService.registerCredits(c.env, builder.did, command),
        E.map((result) => CreditsDataMapper.toRegisterCreditsResponse(result)),
        E.map((response) => c.json<RegisterCreditsResponse>(response)),
        handleTaggedErrors(c),
        E.runPromise,
      );
    },
  );
}

/**
 * Handle GET /v1/credits
 * Get credit balance for the authenticated builder.
 */
export function readCredits(options: ControllerOptions): void {
  const { app, bindings } = options;
  const path = PathsV1.credits.root;

  // Only register route if credits feature is enabled
  if (!hasFeatureFlag(bindings.config.enabledFeatures, FeatureFlag.CREDITS)) {
    return;
  }

  app.get(
    path,
    describeRoute({
      tags: ["Credits"],
      security: [{ bearerAuth: [] }],
      summary: "Get credit balance",
      responses: {
        200: {
          description: "OK",
          content: {
            "application/json": {
              schema: resolver(ReadCreditsResponse),
            },
          },
        },
        ...OpenApiSpecCommonErrorResponses,
      },
    }),
    loadNucToken(bindings),
    loadSubjectAndVerifyAsBuilder(bindings),
    requireNucNamespace(NucCmd.nil.db.credits.read),
    async (c) => {
      const builder = c.get("builder");

      return pipe(
        CreditsService.getBalance(c.env, builder.did),
        E.map((result) => CreditsDataMapper.toReadCreditsResponse(result)),
        E.map((response) => c.json<ReadCreditsResponse>(response)),
        handleTaggedErrors(c),
        E.runPromise,
      );
    },
  );
}

/**
 * Handle GET /v1/credits/payments
 * Get payment history for the authenticated builder.
 */
export function readPayments(options: ControllerOptions): void {
  const { app, bindings } = options;
  const path = PathsV1.credits.payments;

  if (!hasFeatureFlag(bindings.config.enabledFeatures, FeatureFlag.CREDITS)) {
    return;
  }

  app.get(
    path,
    describeRoute({
      tags: ["Credits"],
      security: [{ bearerAuth: [] }],
      summary: "Get payment history",
      responses: {
        200: {
          description: "OK",
          content: {
            "application/json": {
              schema: resolver(ReadPaymentsResponse),
            },
          },
        },
        ...OpenApiSpecCommonErrorResponses,
      },
    }),
    zValidator("query", PaginationQuerySchema),
    loadNucToken(bindings),
    loadSubjectAndVerifyAsBuilder(bindings),
    requireNucNamespace(NucCmd.nil.db.credits.read),
    async (c) => {
      const builder = c.get("builder");
      const { limit, offset } = c.req.valid("query");

      return pipe(
        CreditsService.getPaymentHistory(c.env, builder.did, limit, offset),
        E.map((result) => CreditsDataMapper.toReadPaymentsResponse(result)),
        E.map((response) => c.json<ReadPaymentsResponse>(response)),
        handleTaggedErrors(c),
        E.runPromise,
      );
    },
  );
}

/**
 * Handle GET /v1/credits/pricing
 * Get pricing information (public endpoint).
 */
export function readPricing(options: ControllerOptions): void {
  const { app, bindings } = options;
  const path = PathsV1.credits.pricing;

  // Only register route if credits feature is enabled
  if (!hasFeatureFlag(bindings.config.enabledFeatures, FeatureFlag.CREDITS)) {
    return;
  }

  app.get(
    path,
    describeRoute({
      tags: ["Credits"],
      summary: "Get pricing information",
      responses: {
        200: {
          description: "OK",
          content: {
            "application/json": {
              schema: resolver(ReadPricingResponse),
            },
          },
        },
      },
    }),
    async (c) => {
      return pipe(
        CreditsService.getPricing(c.env),
        E.map((result) => CreditsDataMapper.toReadPricingResponse(result)),
        E.map((response) => c.json<ReadPricingResponse>(response)),
        handleTaggedErrors(c),
        E.runPromise,
      );
    },
  );
}
