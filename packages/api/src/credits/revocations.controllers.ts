import { handleTaggedErrors } from "@nildb/common/handler";
import { OpenApiSpecCommonErrorResponses, OpenApiSpecEmptySuccessResponses } from "@nildb/common/openapi";
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
  LookupRevocationsRequest,
  LookupRevocationsResponse,
  NucCmd,
  PathsV1,
  RevokeTokenRequest,
  type RevokeTokenResponse,
} from "@nillion/nildb-types";

import * as CreditsService from "./credits.services";

/**
 * Handle POST /v1/revocations/revoke
 * Revoke a token.
 */
export function revokeToken(options: ControllerOptions): void {
  const { app, bindings } = options;
  const path = PathsV1.revocations.revoke;

  // Only register route if credits feature is enabled
  if (!hasFeatureFlag(bindings.config.enabledFeatures, FeatureFlag.CREDITS)) {
    return;
  }

  app.post(
    path,
    describeRoute({
      tags: ["Revocations"],
      security: [{ bearerAuth: [] }],
      summary: "Revoke a token",
      responses: {
        204: OpenApiSpecEmptySuccessResponses["204"],
        ...OpenApiSpecCommonErrorResponses,
      },
    }),
    zValidator("json", RevokeTokenRequest),
    loadNucToken(bindings),
    loadSubjectAndVerifyAsBuilder(bindings),
    requireNucNamespace(NucCmd.nuc.revoke),
    async (c) => {
      const builder = c.get("builder");
      const payload = c.req.valid("json");

      // Default expiry to 1 year if not specified
      const expiresAt = payload.expiresAt
        ? new Date(payload.expiresAt)
        : new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);

      return pipe(
        CreditsService.addRevocation(c.env, {
          tokenHash: payload.tokenHash,
          revokedBy: builder.did,
          expiresAt,
        }),
        E.map(() => c.text<RevokeTokenResponse>("")),
        handleTaggedErrors(c),
        E.runPromise,
      );
    },
  );
}

/**
 * Handle POST /v1/revocations/lookup
 * Check if tokens are revoked.
 */
export function lookupRevocations(options: ControllerOptions): void {
  const { app, bindings } = options;
  const path = PathsV1.revocations.lookup;

  // Only register route if credits feature is enabled
  if (!hasFeatureFlag(bindings.config.enabledFeatures, FeatureFlag.CREDITS)) {
    return;
  }

  app.post(
    path,
    describeRoute({
      tags: ["Revocations"],
      summary: "Lookup token revocations",
      responses: {
        200: {
          description: "OK",
          content: {
            "application/json": {
              schema: resolver(LookupRevocationsResponse),
            },
          },
        },
        ...OpenApiSpecCommonErrorResponses,
      },
    }),
    zValidator("json", LookupRevocationsRequest),
    async (c) => {
      const payload = c.req.valid("json");

      return pipe(
        CreditsService.checkRevocations(c.env, payload.tokenHashes),
        E.map((revoked) => {
          const response: LookupRevocationsResponse = {
            data: { revoked },
          };
          return c.json<LookupRevocationsResponse>(response);
        }),
        handleTaggedErrors(c),
        E.runPromise,
      );
    },
  );
}
