import {
  type Command,
  Did,
  type NucToken,
  NucTokenEnvelopeSchema,
  NucTokenValidator,
  ValidationParameters,
} from "@nillion/nuc";
import { Effect as E, pipe } from "effect";
import type { Context, Input, MiddlewareHandler, Next } from "hono";
import { StatusCodes, getReasonPhrase } from "http-status-codes";
import { z } from "zod";
import * as AccountsRepository from "#/accounts/accounts.repository";
import type { Path } from "#/common/paths";
import type { AppBindings, AppContext, AppEnv } from "#/env";

export function verifyNucAndLoadSubject(
  bindings: AppBindings,
): MiddlewareHandler {
  const { log, config } = bindings;

  const nilauthDid = Did.fromHex(config.nilauthPubKey);

  return async (c: AppContext, next: Next) => {
    try {
      // TODO(tim): 'now' is fixed in these to the moment of instantiation not when the validation is called
      //  now should be determined dynamically when validation is called
      const defaultValidationParameters = new ValidationParameters();
      const validateNucWithSubscription = new NucTokenValidator([nilauthDid]);

      // hardcoded for demo to sidestep figuring out auth in the flow: owui frontend --> owui server -[auth]-> nildb
      const authHeader =
        "Bearer eyJhbGciOiJFUzI1NksifQ.eyJpc3MiOiJkaWQ6bmlsOjAyMDAzNzNmYzcwNTk4ZjQ0MmJhNGNmNjdiOGYzMTVlZjRkNjU3ZTJlMjk4NmU4NDIyOTAyNjc1ZTVhNDRjMGRiZCIsImF1ZCI6ImRpZDpuaWw6MDJkMWYxOThkZjlhNjRmZmEyN2MyOTM4NjFiYWNlOGM4MGJkNmIxZTE1MGUwMDgyNjdmN2Y5NGVhZTllNmMzODBjIiwic3ViIjoiZGlkOm5pbDowMjAwMzczZmM3MDU5OGY0NDJiYTRjZjY3YjhmMzE1ZWY0ZDY1N2UyZTI5ODZlODQyMjkwMjY3NWU1YTQ0YzBkYmQiLCJjbWQiOiIvbmlsL2RiIiwiYXJncyI6e30sIm5vbmNlIjoiYjYyODVlNGQ2MmUxNjkyZDFkNzM2NTRiM2E3NDIyNDYiLCJwcmYiOlsiM2Q3MDU5ZTdkNTRlNzE1NjE0ODFkOTVhNGZiNDcwNjgwYjE2ZjkyMTg1YjU2ZjMwNzY3ZThlMDNkZjlkNmJjNCJdfQ.vP1EYRnNT0quGt5fWMwWrpLAZqRWifGMY1PxCIudXmwTHVWzVlIgK398Q5DPLItdwjhSnHOc-iLc7luOHR5b3g/eyJhbGciOiJFUzI1NksifQ.eyJpc3MiOiJkaWQ6bmlsOjAyMDAzNzNmYzcwNTk4ZjQ0MmJhNGNmNjdiOGYzMTVlZjRkNjU3ZTJlMjk4NmU4NDIyOTAyNjc1ZTVhNDRjMGRiZCIsImF1ZCI6ImRpZDpuaWw6MDIwMDM3M2ZjNzA1OThmNDQyYmE0Y2Y2N2I4ZjMxNWVmNGQ2NTdlMmUyOTg2ZTg0MjI5MDI2NzVlNWE0NGMwZGJkIiwic3ViIjoiZGlkOm5pbDowMjAwMzczZmM3MDU5OGY0NDJiYTRjZjY3YjhmMzE1ZWY0ZDY1N2UyZTI5ODZlODQyMjkwMjY3NWU1YTQ0YzBkYmQiLCJjbWQiOiIvbmlsL2RiIiwicG9sIjpbXSwibm9uY2UiOiI0YWVkMTY0ZWQzYzc1ODgzZjJlY2YzNWE1MTQxNDdmMCJ9.ETAlK27Wh2l0xVK-0j85d9rE6BRTR5xMrh4XEFkZ3H91MPwp4XpTROBCayDQeLZwXAq3cGFXvmE-LhfB37-Nug";
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
      const { token } = envelope.token;

      const subject = token.subject.toString();
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

      // both branches throw on validation failure
      // if (account._type === RoleSchema.enum.organization) {
      //   validateNucWithSubscription.validate(
      //     envelope,
      //     defaultValidationParameters,
      //   );
      //   // check revocations last because it's costly (in terms of network RTT)
      //   const { revoked } = await NilauthClient.findRevocationsInProofChain(
      //     config.nilauthBaseUrl,
      //     envelope,
      //   );
      //   if (revoked.length !== 0) {
      //     const hashes = revoked.map((r) => r.tokenHash).join(",");
      //     log.warn(
      //       "Token revoked: revoked_hashes=(%s) auth_token=%O",
      //       hashes,
      //       envelope.token.token.toJson(),
      //     );
      //     return c.text(
      //       getReasonPhrase(StatusCodes.UNAUTHORIZED),
      //       StatusCodes.UNAUTHORIZED,
      //     );
      //   }
      // } else {
      //   envelope.validateSignatures();
      // }

      c.set("envelope", envelope);
      c.set("account", account);

      return next();
    } catch (error) {
      log.error("Auth error:", error);
      return c.text(
        getReasonPhrase(StatusCodes.UNAUTHORIZED),
        StatusCodes.UNAUTHORIZED,
      );
    }
  };
}

export const RoleSchema = z.enum(["root", "admin", "organization", "user"]);
export type Role = z.infer<typeof RoleSchema>;

export type ValidatedJsonInput<T> = Input & {
  out: {
    json: T;
  };
};

// biome-ignore lint/complexity/noBannedTypes: following hono's expected types
export type EnforceCapabilityOptions<I extends Input = {}> = {
  path: Path;
  cmd: Command;
  roles: Role[];
  // biome-ignore lint/suspicious/noExplicitAny: following hono's expected types
  validate: (c: Context<AppEnv, any, I>, token: NucToken) => boolean;
};

export function enforceCapability(
  bindings: AppBindings,
  options: EnforceCapabilityOptions,
): MiddlewareHandler {
  const { log } = bindings;

  return async (c: AppContext, next) => {
    const { token } = c.get("envelope").token;
    const account = c.get("account");

    if (c.req.path !== options.path) {
      log.warn("Path mismatch: %s, expected: %s", c.req.path, options.path);
    }

    if (!options.roles.includes(account._type)) {
      log.debug(
        "Role is not allowed at this path: role=%s path=%s",
        account._type,
        options.path,
      );
      return c.text(
        getReasonPhrase(StatusCodes.FORBIDDEN),
        StatusCodes.FORBIDDEN,
      );
    }

    const isValidCommand = options.cmd.isAttenuationOf(token.command);
    if (!isValidCommand) {
      log.debug(
        "Invalid command: %s, expected: %s",
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
