import * as BuilderRepository from "@nildb/builders/builders.repository";
import type { BuilderDocument } from "@nildb/builders/builders.types";
import * as CreditsRepository from "@nildb/credits/credits.repository";
import { FeatureFlag, hasFeatureFlag, type AppBindings, type AppEnv, type NilauthInstance } from "@nildb/env";
import * as UserRepository from "@nildb/users/users.repository";
import { Effect as E, pipe } from "effect";
import type { BlankInput, Input, MiddlewareHandler } from "hono/types";
import { getReasonPhrase, StatusCodes } from "http-status-codes";

import { NilauthClient } from "@nillion/nilauth-client";
import { normalizeIdentifier } from "@nillion/nildb-shared";
import { getProofChainHashes } from "@nillion/nilpay-client";
import { Codec, Did, type Did as DidType, type Envelope, type Nuc, Payload, Validator } from "@nillion/nuc";

type NilauthInstanceWithDid = NilauthInstance & { did: DidType };

/**
 * Parse the supportedChainIds config string into a number array.
 * Returns empty array if not configured.
 */
function parseSupportedChainIds(raw: string | undefined): number[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((s) => Number.parseInt(s.trim(), 10))
    .filter(Boolean);
}

/**
 * Validate that any EIP-712 signed tokens in the envelope were signed on a supported chain.
 * Skips validation if supportedChainIds is empty (not configured).
 */
export function validateEip712ChainId(envelope: Envelope, supportedChainIds: number[]): void {
  if (supportedChainIds.length === 0) return;

  const tokens: Nuc[] = [envelope.nuc, ...envelope.proofs];
  for (const token of tokens) {
    const header = JSON.parse(Buffer.from(token.rawHeader, "base64url").toString());
    if (header.typ !== "nuc+eip712") continue;

    const tokenChainId = header.meta?.domain?.chainId;
    if (tokenChainId !== undefined && !supportedChainIds.includes(tokenChainId)) {
      throw new Error(
        `EIP-712 token signed on chain ${tokenChainId}, expected one of [${supportedChainIds.join(", ")}]`,
      );
    }
  }
}

function buildNilauthInstancesWithDids(instances: NilauthInstance[]): NilauthInstanceWithDid[] {
  return instances.map((instance) => ({
    ...instance,
    did: Did.fromPublicKey(instance.publicKey),
  }));
}

function extractRootIssuerDid(envelope: Envelope): Did {
  const proofs = envelope.proofs;
  const rootToken = proofs.length > 0 ? proofs[proofs.length - 1] : envelope.nuc;
  return rootToken.payload.iss;
}

/**
 * Determine if a builder should use nilauth (delegated) authentication.
 * Nilauth auth is used when:
 * 1. NILAUTH feature flag is enabled
 * 2. Builder does not have credits (creditsUsd field is undefined)
 */
function shouldUseNilauthAuth(config: { enabledFeatures: string[] }, builder: BuilderDocument): boolean {
  if (!hasFeatureFlag(config.enabledFeatures, FeatureFlag.NILAUTH)) {
    return false;
  }
  // Nilauth mode only applies to builders without credits
  return builder.creditsUsd === undefined;
}

/**
 * Check local revocations for any token in the proof chain.
 */
async function checkLocalRevocations(bindings: AppBindings, envelope: Envelope): Promise<string[]> {
  const tokenHashes = getProofChainHashes(envelope);
  const revoked = await pipe(
    CreditsRepository.findRevocationsByTokenHashes(bindings, tokenHashes),
    E.map((revocations) => revocations.map((r) => r.tokenHash)),
    E.catchAll(() => E.succeed([] as string[])),
    E.runPromise,
  );
  return revoked;
}

export function loadNucToken<P extends string = string, I extends Input = BlankInput, E extends AppEnv = AppEnv>(
  bindings: AppBindings,
): MiddlewareHandler<E, P, I> {
  const { log } = bindings;
  return async (c, next) => {
    try {
      const authHeader = c.req.header("Authorization") ?? "";
      const [scheme, tokenString] = authHeader.split(" ");
      if (scheme.toLowerCase() !== "bearer") {
        return c.text(getReasonPhrase(StatusCodes.UNAUTHORIZED), StatusCodes.UNAUTHORIZED);
      }

      // We must use the unsafe decode first to extract the subject/claims required
      // to fetch the correct context (User/Builder) for validation
      const envelope = Codec._unsafeDecodeBase64Url(tokenString);
      c.set("envelope", envelope);

      return next();
    } catch (cause) {
      if (cause && typeof cause === "object" && "message" in cause) {
        log.error({ cause: cause.message }, "Auth error");
      } else {
        log.error({ cause: "unknown" }, "Auth error");
      }
      return c.text(getReasonPhrase(StatusCodes.UNAUTHORIZED), StatusCodes.UNAUTHORIZED);
    }
  };
}

export function verifySelfSignedNuc<P extends string = string, I extends Input = BlankInput, E extends AppEnv = AppEnv>(
  bindings: AppBindings,
): MiddlewareHandler<E, P, I> {
  const { log } = bindings;
  return async (c, next) => {
    try {
      const envelope: Envelope = c.get("envelope");
      const subject = Did.serialize(envelope.nuc.payload.sub);
      const canonicalSubject = normalizeIdentifier(subject, log);

      await Validator.validate(envelope, {
        rootIssuers: [canonicalSubject],
        params: {
          tokenRequirements: {
            type: "invocation",
            audience: bindings.node.did.didString,
          },
        },
      });

      c.set("subjectDid", canonicalSubject);
      return next();
    } catch (cause) {
      if (cause && typeof cause === "object" && "message" in cause) {
        log.error({ cause: cause.message }, "Auth error");
      } else {
        log.error({ cause: "unknown" }, "Auth error");
      }
      return c.text(getReasonPhrase(StatusCodes.UNAUTHORIZED), StatusCodes.UNAUTHORIZED);
    }
  };
}

export function loadSubjectAndVerifyAsCreditAdmin<
  P extends string = string,
  I extends Input = BlankInput,
  E extends AppEnv = AppEnv,
>(bindings: AppBindings): MiddlewareHandler<E, P, I> {
  const { log } = bindings;

  return async (c, next) => {
    if (!bindings.admin) {
      return c.text(getReasonPhrase(StatusCodes.FORBIDDEN), StatusCodes.FORBIDDEN);
    }

    try {
      const envelope: Envelope = c.get("envelope");

      await Validator.validate(envelope, {
        rootIssuers: [bindings.admin.did.didString],
        params: {
          tokenRequirements: {
            type: "invocation",
            audience: bindings.node.did.didString,
          },
        },
      });

      c.set("subjectDid", bindings.admin.did.didString);
      return next();
    } catch (cause) {
      if (cause && typeof cause === "object" && "message" in cause) {
        log.error({ cause: cause.message }, "Admin auth error");
      } else {
        log.error({ cause: "unknown" }, "Admin auth error");
      }
      return c.text(getReasonPhrase(StatusCodes.UNAUTHORIZED), StatusCodes.UNAUTHORIZED);
    }
  };
}

export function loadSubjectAndVerifyAsAdmin<
  P extends string = string,
  I extends Input = BlankInput,
  E extends AppEnv = AppEnv,
>(bindings: AppBindings): MiddlewareHandler<E, P, I> {
  const { log } = bindings;
  const nildbNodeDid = bindings.node.did;

  return async (c, next) => {
    try {
      const envelope = c.get("envelope");
      await Validator.validate(envelope, {
        rootIssuers: [nildbNodeDid.didString],
      });
      return next();
    } catch (cause) {
      if (cause && typeof cause === "object" && "message" in cause) {
        log.error({ cause: cause.message }, "Auth error");
      } else {
        log.error({ cause: "unknown" }, "Auth error");
      }
      return c.text(getReasonPhrase(StatusCodes.UNAUTHORIZED), StatusCodes.UNAUTHORIZED);
    }
  };
}

export function loadSubjectAndVerifyAsBuilder<
  P extends string = string,
  I extends Input = BlankInput,
  E extends AppEnv = AppEnv,
>(bindings: AppBindings): MiddlewareHandler<E, P, I> {
  const { log, config } = bindings;
  const supportedChainIds = parseSupportedChainIds(config.supportedChainIds);

  // Only build nilauth instances when the feature is enabled
  const nilauthInstances = hasFeatureFlag(config.enabledFeatures, FeatureFlag.NILAUTH)
    ? buildNilauthInstancesWithDids(config.nilauthInstances)
    : [];
  const nilauthRootIssuers = nilauthInstances.map((n) => n.did.didString);

  return async (c, next) => {
    try {
      const envelope: Envelope = c.get("envelope");
      const token = envelope.nuc.payload;
      const subject = Did.serialize(token.sub);

      // All Dids were migrated to did:key as of 1.1.0 but the legacy `did:nil` format
      // is still used in Nucs, and so, we need to adopt a canonical format given internal
      // db lookups are simple string comparisons
      const canonicalSubject = normalizeIdentifier(subject, log);

      // load builder
      const builder = await pipe(
        BuilderRepository.findByIdWithCache(bindings, canonicalSubject),
        E.catchAll((_e) => E.succeed(null)),
        E.runPromise,
      );

      if (!builder) {
        c.env.log.debug("Unknown builder: %s", subject);
        return c.text(getReasonPhrase(StatusCodes.NOT_FOUND), StatusCodes.NOT_FOUND);
      }

      const context = {
        req: {
          path: c.req.path,
          headers: c.req.header(),
        },
        payload: {
          // @ts-expect-error requires zValidator to run before the capability middleware but we cannot straightforwardly bring types into this scope
          body: c.req.valid("json") ?? {},
          // @ts-expect-error requires zValidator to run before the capability middleware but we cannot straightforwardly bring types into this scope
          query: c.req.valid("query") ?? {},
          // @ts-expect-error requires zValidator to run before the capability middleware but we cannot straightforwardly bring types into this scope
          param: c.req.valid("param") ?? {},
        },
      };

      const nildbNodeDid = bindings.node.did;

      // Determine which authentication mode to use
      if (shouldUseNilauthAuth(config, builder)) {
        // Nilauth mode: validate against nilauth root issuers
        await Validator.validate(envelope, {
          rootIssuers: nilauthRootIssuers,
          params: {
            tokenRequirements: {
              type: "invocation",
              audience: nildbNodeDid.didString,
            },
          },
          context,
        });

        validateEip712ChainId(envelope, supportedChainIds);

        // Check revocations last because it's costly (in terms of network RTT)
        // Find the nilauth instance that issued the root token in the proof chain
        const rootIssuerDid = extractRootIssuerDid(envelope);
        const matchingNilauth = nilauthInstances.find((n) => Did.areEqual(n.did, rootIssuerDid));

        if (!matchingNilauth) {
          log.error("No matching nilauth instance found for root issuer: %s", rootIssuerDid.didString);
          return c.text(getReasonPhrase(StatusCodes.UNAUTHORIZED), StatusCodes.UNAUTHORIZED);
        }

        const nilauthClient = await NilauthClient.create({
          baseUrl: matchingNilauth.baseUrl,
          chainId: config.nilauthChainId,
        });
        const { revoked } = await nilauthClient.findRevocationsInProofChain(envelope);

        if (revoked.length !== 0) {
          const hashes = revoked.map((r) => r.tokenHash).join(",");
          log.warn("Token revoked: revoked_hashes=(%s) auth_token=%O", hashes, token);
          return c.text(getReasonPhrase(StatusCodes.UNAUTHORIZED), StatusCodes.UNAUTHORIZED);
        }
      } else {
        // Self-signed mode: the user is their own root issuer
        await Validator.validate(envelope, {
          rootIssuers: [canonicalSubject],
          params: {
            tokenRequirements: {
              type: "invocation",
              audience: nildbNodeDid.didString,
            },
          },
          context,
        });

        validateEip712ChainId(envelope, supportedChainIds);

        // Check local revocations instead of nilauth
        const revokedHashes = await checkLocalRevocations(bindings, envelope);
        if (revokedHashes.length > 0) {
          log.warn("Token revoked (local): revoked_hashes=(%s) auth_token=%O", revokedHashes.join(","), token);
          return c.text(getReasonPhrase(StatusCodes.UNAUTHORIZED), StatusCodes.UNAUTHORIZED);
        }
      }

      c.set("builder", builder);

      return next();
    } catch (cause) {
      if (cause && typeof cause === "object" && "message" in cause) {
        log.error({ cause: cause.message }, "Auth error");

        // We want to return PAYMENT_REQUIRED when invocation NUC's chain is missing authority from nilauth
        const message = cause.message as string;
        if (message === Validator.ROOT_KEY_SIGNATURE_MISSING) {
          return c.text(getReasonPhrase(StatusCodes.PAYMENT_REQUIRED), StatusCodes.PAYMENT_REQUIRED);
        }
      } else {
        log.error({ cause: "unknown" }, "Auth error");
      }
      return c.text(getReasonPhrase(StatusCodes.UNAUTHORIZED), StatusCodes.UNAUTHORIZED);
    }
  };
}

export function loadSubjectAndVerifyAsUser<
  P extends string = string,
  I extends Input = BlankInput,
  E extends AppEnv = AppEnv,
>(bindings: AppBindings): MiddlewareHandler<E, P, I> {
  const { log } = bindings;

  return async (c, next) => {
    try {
      const envelope: Envelope = c.get("envelope");
      const token = envelope.nuc.payload;
      const subject = token.sub.didString;

      // All Dids were migrated to did:key as of 1.1.0 but the legacy `did:nil` format
      // is still used in Nucs, and so, we need to adopt a canonical format given internal
      // db lookups are simple string comparisons
      const canonicalSubject = normalizeIdentifier(subject, log);

      // load user
      const user = await pipe(
        UserRepository.findById(bindings, canonicalSubject),
        E.catchAll((_e) => E.succeed(null)),
        E.runPromise,
      );

      if (!user) {
        c.env.log.debug("Unknown user: %s", subject);
        return c.text(getReasonPhrase(StatusCodes.UNAUTHORIZED), StatusCodes.UNAUTHORIZED);
      }
      await Validator.validate(envelope, {
        rootIssuers: [subject],
      });
      c.set("user", user);
      return next();
    } catch (cause) {
      if (cause && typeof cause === "object" && "message" in cause) {
        log.error({ cause: cause.message }, "Auth error");
      } else {
        log.error({ cause: "unknown" }, "Auth error");
      }
      return c.text(getReasonPhrase(StatusCodes.UNAUTHORIZED), StatusCodes.UNAUTHORIZED);
    }
  };
}

export function requireNucNamespace(cmd: string): MiddlewareHandler {
  return async (c, next) => {
    const { log } = c.env;
    const envelope: Envelope = c.get("envelope");
    const token = envelope.nuc.payload;

    const isValidCommand = Payload.isCommandAttenuationOf(cmd, token.cmd);
    if (!isValidCommand) {
      log.debug(
        "Nuc does not grant access to access %s: token command '%s' is not an attenuation of '%s'",
        c.req.path,
        token.cmd,
        cmd,
      );
      return c.text(getReasonPhrase(StatusCodes.FORBIDDEN), StatusCodes.FORBIDDEN);
    }

    return next();
  };
}
