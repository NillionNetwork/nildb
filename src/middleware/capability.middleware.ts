import {
  Codec,
  Did,
  type Envelope,
  NilauthClient,
  Payload,
  Validator,
} from "@nillion/nuc";
import { Effect as E, pipe } from "effect";
import type { BlankInput, Input, MiddlewareHandler } from "hono/types";
import { getReasonPhrase, StatusCodes } from "http-status-codes";
import * as BuilderRepository from "#/builders/builders.repository";
import type { AppBindings, AppEnv } from "#/env";
import * as UserRepository from "#/users/users.repository";

export function loadNucToken<
  P extends string = string,
  I extends Input = BlankInput,
  E extends AppEnv = AppEnv,
>(bindings: AppBindings): MiddlewareHandler<E, P, I> {
  const { log } = bindings;
  return async (c, next) => {
    try {
      const authHeader = c.req.header("Authorization") ?? "";
      const [scheme, tokenString] = authHeader.split(" ");
      if (scheme.toLowerCase() !== "bearer") {
        return c.text(
          getReasonPhrase(StatusCodes.UNAUTHORIZED),
          StatusCodes.UNAUTHORIZED,
        );
      }

      const envelope = Codec.decodeBase64Url(tokenString);
      c.set("envelope", envelope);

      return next();
    } catch (cause) {
      if (cause && typeof cause === "object" && "message" in cause) {
        log.error({ cause: cause.message }, "Auth error");
      } else {
        log.error({ cause: "unknown" }, "Auth error");
      }
      return c.text(
        getReasonPhrase(StatusCodes.UNAUTHORIZED),
        StatusCodes.UNAUTHORIZED,
      );
    }
  };
}

export function loadSubjectAndVerifyAsAdmin<
  P extends string = string,
  I extends Input = BlankInput,
  E extends AppEnv = AppEnv,
>(bindings: AppBindings): MiddlewareHandler<E, P, I> {
  const { log } = bindings;

  const nildbNodeDid = bindings.node.keypair.toDid();

  return async (c, next) => {
    try {
      const envelope = c.get("envelope");
      Validator.validate(envelope, { rootIssuers: [nildbNodeDid.didString] });
      return next();
    } catch (cause) {
      if (cause && typeof cause === "object" && "message" in cause) {
        log.error({ cause: cause.message }, "Auth error");
      } else {
        log.error({ cause: "unknown" }, "Auth error");
      }
      return c.text(
        getReasonPhrase(StatusCodes.UNAUTHORIZED),
        StatusCodes.UNAUTHORIZED,
      );
    }
  };
}

export function loadSubjectAndVerifyAsBuilder<
  P extends string = string,
  I extends Input = BlankInput,
  E extends AppEnv = AppEnv,
>(bindings: AppBindings): MiddlewareHandler<E, P, I> {
  const { log, config } = bindings;

  return async (c, next) => {
    try {
      const envelope: Envelope = c.get("envelope");
      const token = envelope.nuc.payload;
      const subject = Did.serialize(token.sub);

      // load builder
      const builder = await pipe(
        BuilderRepository.findByIdWithCache(bindings, subject),
        E.catchAll((_e) => E.succeed(null)),
        E.runPromise,
      );

      if (!builder) {
        c.env.log.debug("Unknown builder: %s", subject);
        return c.text(
          getReasonPhrase(StatusCodes.UNAUTHORIZED),
          StatusCodes.UNAUTHORIZED,
        );
      }

      // @ts-ignore
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

      // TODO: Update when nilauth supports did:key
      const nilauthDid = Did.fromPublicKey(config.nilauthPubKey, "nil");
      const nildbNodeDid = bindings.node.keypair.toDid();

      Validator.validate(envelope, {
        rootIssuers: [nilauthDid.didString],
        params: {
          tokenRequirements: {
            type: "invocation",
            audience: nildbNodeDid.didString,
          },
        },
        context,
      });

      // check revocations last because it's costly (in terms of network RTT)
      const nilauthClient = await NilauthClient.create({
        baseUrl: config.nilauthBaseUrl,
      });
      const { revoked } =
        await nilauthClient.findRevocationsInProofChain(envelope);

      if (revoked.length !== 0) {
        const hashes = revoked.map((r) => r.tokenHash).join(",");
        log.warn(
          "Token revoked: revoked_hashes=(%s) auth_token=%O",
          hashes,
          token,
        );
        return c.text(
          getReasonPhrase(StatusCodes.UNAUTHORIZED),
          StatusCodes.UNAUTHORIZED,
        );
      }
      c.set("builder", builder);

      return next();
    } catch (cause) {
      if (cause && typeof cause === "object" && "message" in cause) {
        log.error({ cause: cause.message }, "Auth error");

        // This isn't an elegant approach, but we want to return PAYMENT_REQUIRED
        // to communicate when invocation NUC's chain is missing authority from nilauth
        const message = cause.message as string;
        if (message.includes("not signed by root")) {
          return c.text(
            getReasonPhrase(StatusCodes.PAYMENT_REQUIRED),
            StatusCodes.PAYMENT_REQUIRED,
          );
        }
      } else {
        log.error({ cause: "unknown" }, "Auth error");
      }
      return c.text(
        getReasonPhrase(StatusCodes.UNAUTHORIZED),
        StatusCodes.UNAUTHORIZED,
      );
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
      // load user
      const user = await pipe(
        UserRepository.findById(bindings, subject),
        E.catchAll((_e) => E.succeed(null)),
        E.runPromise,
      );

      if (!user) {
        c.env.log.debug("Unknown user: %s", subject);
        return c.text(
          getReasonPhrase(StatusCodes.UNAUTHORIZED),
          StatusCodes.UNAUTHORIZED,
        );
      }
      Validator.validate(envelope, {
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
      return c.text(
        getReasonPhrase(StatusCodes.UNAUTHORIZED),
        StatusCodes.UNAUTHORIZED,
      );
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
      return c.text(
        getReasonPhrase(StatusCodes.FORBIDDEN),
        StatusCodes.FORBIDDEN,
      );
    }

    return next();
  };
}
