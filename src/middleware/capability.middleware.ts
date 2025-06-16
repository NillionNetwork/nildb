import {
  type Command,
  Did,
  InvocationRequirement,
  NilauthClient,
  NucTokenEnvelopeSchema,
  NucTokenValidator,
  ValidationParameters,
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

      const nucEnvelopeParseResult =
        NucTokenEnvelopeSchema.safeParse(tokenString);
      if (!nucEnvelopeParseResult.success) {
        log.debug("Failed to parse nuc envelope: %s", tokenString);
        return c.text(
          getReasonPhrase(StatusCodes.UNAUTHORIZED),
          StatusCodes.UNAUTHORIZED,
        );
      }
      const envelope = nucEnvelopeParseResult.data;
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
  return async (c, next) => {
    try {
      // TODO check that node has delegated admin permissions
      c.get("envelope").validateSignatures();
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

  const nilauthDid = Did.fromHex(config.nilauthPubKey);
  const nildbNodeDid = Did.fromHex(bindings.node.keypair.publicKey("hex"));

  const defaultValidationParameters = new ValidationParameters({
    tokenRequirements: new InvocationRequirement(nildbNodeDid),
  });
  const validateNucWithSubscription = new NucTokenValidator([nilauthDid]);

  return async (c, next) => {
    try {
      const envelope = c.get("envelope");
      const token = envelope.token.token;
      const subject = token.subject.toString();

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
      validateNucWithSubscription.validate(
        envelope,
        defaultValidationParameters,
      );
      // check revocations last because it's costly (in terms of network RTT)
      const { revoked } = await NilauthClient.findRevocationsInProofChain(
        config.nilauthBaseUrl,
        envelope,
      );
      if (revoked.length !== 0) {
        const hashes = revoked.map((r) => r.tokenHash).join(",");
        log.warn(
          "Token revoked: revoked_hashes=(%s) auth_token=%O",
          hashes,
          token.token.toJson(),
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
        log.error({ cause: JSON.stringify(cause) }, "Auth error");

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
      const envelope = c.get("envelope");
      const token = envelope.token.token;
      const subject = token.subject.toString();
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
      envelope.validateSignatures();
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

export function requireNucNamespace(cmd: Command): MiddlewareHandler {
  return async (c, next) => {
    const { log } = c.env;
    const { token } = c.get("envelope").token;

    const isValidCommand = cmd.isAttenuationOf(token.command);
    if (!isValidCommand) {
      log.debug(
        "Nuc does not grant access to access %s: token command '%s' is not an attenuation of '%s'",
        c.req.path,
        token.command.toString(),
        cmd.toString(),
      );
      return c.text(
        getReasonPhrase(StatusCodes.FORBIDDEN),
        StatusCodes.FORBIDDEN,
      );
    }

    return next();
  };
}
