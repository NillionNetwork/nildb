import {
  type Command,
  Did,
  InvocationRequirement,
  NilauthClient,
  type NucToken,
  NucTokenEnvelopeSchema,
  NucTokenValidator,
  ValidationParameters,
} from "@nillion/nuc";
import { Effect as E, pipe } from "effect";
import type { Context, Env, Input, MiddlewareHandler } from "hono";
import type { BlankInput } from "hono/types";
import { getReasonPhrase, StatusCodes } from "http-status-codes";
import type { EmptyObject } from "type-fest";
import * as AccountsRepository from "#/accounts/accounts.repository";
import type { AppBindings, AppEnv } from "#/env";
import * as UserRepository from "#/user/user.repository";

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
      const envelope = c.get("envelope");
      const token = envelope.token.token;
      const subject = token.subject.toString();

      // load account
      const account = await pipe(
        AccountsRepository.findByIdWithCache(bindings, subject),
        E.catchAll((_e) => E.succeed(null)),
        E.runPromise,
      );

      if (!account) {
        c.env.log.debug("Unknown account: %s", subject);
        return c.text(
          getReasonPhrase(StatusCodes.UNAUTHORIZED),
          StatusCodes.UNAUTHORIZED,
        );
      }

      envelope.validateSignatures();
      c.set("account", account);

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

      // load account
      const account = await pipe(
        AccountsRepository.findByIdWithCache(bindings, subject),
        E.catchAll((_e) => E.succeed(null)),
        E.runPromise,
      );

      if (!account) {
        c.env.log.debug("Unknown account: %s", subject);
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
      c.set("account", account);

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

export type ValidatedOutput = Partial<{
  json: EmptyObject;
  param: EmptyObject;
  query: EmptyObject;
}>;

export type EnforceCapabilityOptions<
  // Define the payload first since it's the most used generic
  ValidatedParams extends Input["out"] = ValidatedOutput,
  Path extends string = string,
  E extends Env = AppEnv,
> = {
  path: Path;
  cmd: Command;
  validate: (
    c: Context<E, Path, { out: ValidatedParams }>,
    token: NucToken,
  ) => boolean | Promise<boolean>;
};

export function enforceCapability<
  // Define the payload first since it's the most used generic
  ValidatedParams extends Input["out"] = ValidatedOutput,
  Path extends string = string,
  E extends AppEnv = AppEnv,
>(
  options: EnforceCapabilityOptions<ValidatedParams, Path, E>,
): MiddlewareHandler<E, Path, { out: ValidatedParams }> {
  return async (c, next) => {
    const { log } = c.env;
    const { token } = c.get("envelope").token;

    if (c.req.path !== options.path) {
      log.warn("Path mismatch: %s, expected: %s", c.req.path, options.path);
    }

    const isValidCommand = options.cmd.isAttenuationOf(token.command);
    if (!isValidCommand) {
      log.debug(
        "Command %s not attenuation of %s",
        token.command.toString(),
        options.cmd.toString(),
      );
      return c.text(
        getReasonPhrase(StatusCodes.FORBIDDEN),
        StatusCodes.FORBIDDEN,
      );
    }

    if (options.validate(c, token)) {
      return next();
    }

    log.debug("Token failed validation check: %O", options);
    return c.text(
      getReasonPhrase(StatusCodes.FORBIDDEN),
      StatusCodes.FORBIDDEN,
    );
  };
}
