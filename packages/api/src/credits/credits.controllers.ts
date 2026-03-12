import * as BuildersRepository from "@nildb/builders/builders.repository";
import { handleTaggedErrors } from "@nildb/common/handler";
import { OpenApiSpecCommonErrorResponses } from "@nildb/common/openapi";
import type { ControllerOptions } from "@nildb/common/types";
import { FeatureFlag, hasFeatureFlag } from "@nildb/env";
import {
  loadNucToken,
  loadSubjectAndVerifyAsBuilder,
  loadSubjectAndVerifyAsCreditAdmin,
  requireNucNamespace,
} from "@nildb/middleware/capability.middleware";
import * as SystemRepository from "@nildb/system/system.repository";
import { Effect as E, pipe } from "effect";
import { describeRoute, resolver, validator as zValidator } from "hono-openapi";
import { z } from "zod";

import {
  AdminCreditTopUpRequest,
  type AdminCreditTopUpResponse,
  type AdminListBuildersResponse,
  AdminUpdatePricingRequest,
  type AdminUpdatePricingResponse,
  type BuilderStatusDto,
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

/**
 * Handle POST /v1/admin/credits/topup
 * Admin top-up credits for a builder.
 */
export function adminCreditTopUp(options: ControllerOptions): void {
  const { app, bindings } = options;
  const path = PathsV1.admin.creditTopUp;

  if (!hasFeatureFlag(bindings.config.enabledFeatures, FeatureFlag.CREDITS) || !bindings.admin) {
    return;
  }

  app.post(
    path,
    describeRoute({
      tags: ["Admin"],
      security: [{ bearerAuth: [] }],
      summary: "Admin credit top-up",
      responses: {
        200: {
          description: "OK",
          content: {
            "application/json": {
              schema: resolver(AdminCreditTopUpRequest),
            },
          },
        },
        ...OpenApiSpecCommonErrorResponses,
      },
    }),
    zValidator("json", AdminCreditTopUpRequest),
    loadNucToken(bindings),
    loadSubjectAndVerifyAsCreditAdmin(bindings),
    requireNucNamespace(NucCmd.nil.db.admin.create),
    async (c) => {
      const { builderDid, amountUsd, reason } = c.req.valid("json");
      const adminDid = c.get("subjectDid");

      return pipe(
        CreditsService.adminTopUpCredits(c.env, adminDid, builderDid, amountUsd, reason),
        E.map(
          (result): AdminCreditTopUpResponse => ({
            data: {
              builderDid: result.builderDid,
              amountUsd: result.amountUsd,
              newBalance: result.newBalance,
              status: result.status as BuilderStatusDto,
            },
          }),
        ),
        E.map((response) => c.json<AdminCreditTopUpResponse>(response)),
        handleTaggedErrors(c),
        E.runPromise,
      );
    },
  );
}

/**
 * Handle PUT /v1/admin/pricing
 * Update storage pricing configuration.
 */
export function adminUpdatePricing(options: ControllerOptions): void {
  const { app, bindings } = options;
  const path = PathsV1.admin.pricing;

  if (!hasFeatureFlag(bindings.config.enabledFeatures, FeatureFlag.CREDITS) || !bindings.admin) {
    return;
  }

  app.put(
    path,
    describeRoute({
      tags: ["Admin"],
      security: [{ bearerAuth: [] }],
      summary: "Update storage pricing",
      responses: {
        200: {
          description: "OK",
          content: {
            "application/json": {
              schema: resolver(AdminUpdatePricingRequest),
            },
          },
        },
        ...OpenApiSpecCommonErrorResponses,
      },
    }),
    zValidator("json", AdminUpdatePricingRequest),
    loadNucToken(bindings),
    loadSubjectAndVerifyAsCreditAdmin(bindings),
    requireNucNamespace(NucCmd.nil.db.admin.create),
    async (c) => {
      const { storageCostPerGbHour } = c.req.valid("json");

      return pipe(
        SystemRepository.upsertPricingConfig(c.env, storageCostPerGbHour),
        E.map(() => {
          c.env.config.storageCostPerGbHour = storageCostPerGbHour;
          return c.json<AdminUpdatePricingResponse>({
            data: { storageCostPerGbHour },
          });
        }),
        handleTaggedErrors(c),
        E.runPromise,
      );
    },
  );
}

const AdminListBuildersQuerySchema = PaginationQuerySchema.extend({
  search: z.string().optional(),
});

/**
 * Handle GET /v1/admin/builders
 * List builders for admin view.
 */
export function adminListBuilders(options: ControllerOptions): void {
  const { app, bindings } = options;
  const path = PathsV1.admin.builders;

  if (!hasFeatureFlag(bindings.config.enabledFeatures, FeatureFlag.CREDITS) || !bindings.admin) {
    return;
  }

  app.get(
    path,
    describeRoute({
      tags: ["Admin"],
      security: [{ bearerAuth: [] }],
      summary: "List builders (admin)",
      responses: {
        200: {
          description: "OK",
        },
        ...OpenApiSpecCommonErrorResponses,
      },
    }),
    zValidator("query", AdminListBuildersQuerySchema),
    loadNucToken(bindings),
    loadSubjectAndVerifyAsCreditAdmin(bindings),
    requireNucNamespace(NucCmd.nil.db.admin.read),
    async (c) => {
      const { limit, offset, search } = c.req.valid("query");

      return pipe(
        BuildersRepository.findAll(c.env, search, limit, offset),
        E.map(
          ({ data, total }): AdminListBuildersResponse => ({
            data: data.map((b) => ({
              did: b.did,
              name: b.name,
              creditsUsd: b.creditsUsd,
              status: (b.creditsUsd !== undefined
                ? CreditsService.computeStatus(b, c.env.config)
                : b.status) as BuilderStatusDto,
              storageBytes: b.storageBytes ?? 0,
            })),
            pagination: { total, limit, offset },
          }),
        ),
        E.map((response) => c.json<AdminListBuildersResponse>(response)),
        handleTaggedErrors(c),
        E.runPromise,
      );
    },
  );
}
