import * as BuilderRepository from "@nildb/builders/builders.repository";
import * as CreditsRepository from "@nildb/credits/credits.repository";
import { parseEthereumChains, type AppBindings, type AppEnv } from "@nildb/env";
import * as UserRepository from "@nildb/users/users.repository";
import { Effect as E, pipe } from "effect";
import type { BlankInput, Input, MiddlewareHandler } from "hono/types";
import { getReasonPhrase, StatusCodes } from "http-status-codes";

import { normalizeIdentifier } from "@nillion/nildb-shared";
import { getProofChainHashes } from "@nillion/nilpay-client";
import { Codec, Did, type Envelope, type Nuc, Payload, Validator } from "@nillion/nuc";

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

/**
 * Check local revocations for any token in the proof chain.
 */
async function checkLocalRevocations(bindings: AppBindings, envelope: Envelope): Promise<string[]> {
  const tokenHashes = getProofChainHashes(envelope);
  const revoked = await pipe(
    CreditsRepository.findRevocationsByTokenHashes(bindings, tokenHashes),
    E.map((revocations) => revocations.map((r) => r.tokenHash)),
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
  const supportedChainIds = [...parseEthereumChains(config.ethereumRpcUrls).keys()];

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
        E.catchAll((error) => {
          log.error("Builder lookup failed for %s: %O", canonicalSubject, error);
          return E.succeed(null);
        }),
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

      await Validator.validate(envelope, {
        rootIssuers: [canonicalSubject],
        params: {
          tokenRequirements: {
            type: "invocation" as const,
            audience: nildbNodeDid.didString,
          },
        },
        context,
      });

      validateEip712ChainId(envelope, supportedChainIds);

      // Check local revocations
      const revokedHashes = await checkLocalRevocations(bindings, envelope);
      if (revokedHashes.length > 0) {
        log.warn("Token revoked: revoked_hashes=(%s) auth_token=%O", revokedHashes.join(","), token);
        return c.text(getReasonPhrase(StatusCodes.UNAUTHORIZED), StatusCodes.UNAUTHORIZED);
      }

      c.set("builder", builder);

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
        E.catchAll((error) => {
          log.error("User lookup failed for %s: %O", canonicalSubject, error);
          return E.succeed(null);
        }),
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
