import * as BuilderRepository from "@nildb/builders/builders.repository";
import type { AppBindings, AppEnv, NilauthInstance } from "@nildb/env";
import * as UserRepository from "@nildb/users/users.repository";
import { Effect as E, pipe } from "effect";
import type { BlankInput, Input, MiddlewareHandler } from "hono/types";
import { getReasonPhrase, StatusCodes } from "http-status-codes";

import { NilauthClient } from "@nillion/nilauth-client";
import { normalizeIdentifier } from "@nillion/nildb-shared";
import { Codec, Did, type Did as DidType, type Envelope, Payload, Validator } from "@nillion/nuc";

type NilauthInstanceWithDid = NilauthInstance & { did: DidType };

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
  const nilauthInstances = buildNilauthInstancesWithDids(config.nilauthInstances);
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
        return c.text(getReasonPhrase(StatusCodes.UNAUTHORIZED), StatusCodes.UNAUTHORIZED);
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
        rootIssuers: nilauthRootIssuers,
        params: {
          tokenRequirements: {
            type: "invocation",
            audience: nildbNodeDid.didString,
          },
        },
        context,
      });

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
