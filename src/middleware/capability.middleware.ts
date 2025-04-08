import {
  type Command,
  type NucToken,
  NucTokenEnvelopeSchema,
} from "@nillion/nuc";
import { Effect as E, pipe } from "effect";
import type { MiddlewareHandler, Next } from "hono";
import { StatusCodes, getReasonPhrase } from "http-status-codes";
import { z } from "zod";
import * as AccountsRepository from "#/accounts/accounts.repository";
import type { Path } from "#/common/paths";
import type { AppBindings, AppContext } from "#/env";

export function verifyNucAndLoadSubject(
  bindings: AppBindings,
): MiddlewareHandler {
  const { log } = bindings;

  return async (c: AppContext, next: Next) => {
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
      // throw on invalid signature
      envelope.validateSignatures();

      const { token } = envelope.token;

      if (!token) {
        return c.text(
          getReasonPhrase(StatusCodes.UNAUTHORIZED),
          StatusCodes.UNAUTHORIZED,
        );
      }

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

      c.set("envelope", envelope);
      c.set("account", account);

      return next();
    } catch (error) {
      bindings.log.error("Auth error:", error);
      return c.text(
        getReasonPhrase(StatusCodes.UNAUTHORIZED),
        StatusCodes.UNAUTHORIZED,
      );
    }
  };
}

export const RoleSchema = z.enum(["root", "admin", "organization", "user"]);
export type Role = z.infer<typeof RoleSchema>;

export type EnforceCapabilityOptions = {
  path: Path;
  cmd: Command;
  roles: Role[];
  validate: (c: AppContext, token: NucToken) => boolean;
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
        "Role not allowed at path: role=%s path=%s",
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
