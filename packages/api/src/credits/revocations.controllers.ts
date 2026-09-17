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
import { StatusCodes } from "http-status-codes";
import { Temporal } from "temporal-polyfill";

import {
  type ApiErrorResponse,
  LookupRevocationsRequest,
  LookupRevocationsResponse,
  NucCmd,
  PathsV1,
  RevokeTokenRequest,
  type RevokeTokenResponse,
} from "@nillion/nildb-types";
import { hashToken } from "@nillion/nilpay-client";
import { Codec, Did, type Envelope, Validator } from "@nillion/nuc";

import * as CreditsService from "./credits.services";

/** Revocations are pointless once the token expires, so cap them there. */
const MAX_REVOCATION_TTL_MS = 365 * 24 * 60 * 60 * 1000;

function errorResponse(errors: string[]): ApiErrorResponse {
  return { ts: Temporal.Now.instant().toString(), errors };
}

export function mayRevokeToken(
  revoker: Envelope["nuc"]["payload"]["iss"],
  target: Pick<Envelope["nuc"]["payload"], "iss" | "aud">,
): boolean {
  return Did.areEqual(revoker, target.iss) || Did.areEqual(revoker, target.aud);
}

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
      const requestEnvelope: Envelope = c.get("envelope");
      const body = c.req.valid("json");
      const { log } = c.env;

      // The token itself is required, not a bare hash: without it the node
      // cannot tell whether the caller has any relationship to the token, and
      // any caller could revoke any hash they could guess or observe.
      let envelope: Envelope;
      try {
        envelope = Codec._unsafeDecodeBase64Url(body.token);
        // Verifies every signature in the chain, the chain links and expiry.
        // rootIssuers is empty because a revoker need not be the chain root.
        await Validator.validate(envelope, { rootIssuers: [] });
      } catch (cause) {
        log.debug({ cause }, "Rejected revocation for an unverifiable token");
        return c.json(errorResponse(["Token is not a valid, unexpired NUC"]), StatusCodes.BAD_REQUEST);
      }

      const target = envelope.nuc.payload;
      // Authorise the key that signed this invocation. The loaded builder is
      // the root subject, so using builder.did here would let any attenuated
      // delegate act with its root's revocation authority.
      const revoker = requestEnvelope.nuc.payload.iss;
      const permitted = mayRevokeToken(revoker, target);

      if (!permitted) {
        log.warn({ revoker: revoker.didString }, "Rejected revocation by a party that is neither issuer nor audience");
        return c.json(
          errorResponse(["Only the issuer or the audience of a token may revoke it"]),
          StatusCodes.FORBIDDEN,
        );
      }

      // Derived here rather than taken from the caller so the recorded hash
      // always matches what the auth path looks up.
      const tokenHash = hashToken(envelope);

      // `exp` is in seconds. Beyond it the token is rejected anyway, so there
      // is no reason to retain the revocation and let the store grow.
      const expiryMs = typeof target.exp === "number" ? target.exp * 1000 : Date.now() + MAX_REVOCATION_TTL_MS;
      const expiresAt = new Date(Math.min(expiryMs, Date.now() + MAX_REVOCATION_TTL_MS));

      return pipe(
        CreditsService.addRevocation(c.env, {
          tokenHash,
          revokedBy: revoker.didString,
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
