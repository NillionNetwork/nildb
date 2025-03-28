import { Command, NucTokenEnvelopeSchema } from "@nillion/nuc";
import { Effect as E, pipe } from "effect";
import type { MiddlewareHandler, Next } from "hono";
import { StatusCodes, getReasonPhrase } from "http-status-codes";
import * as AccountsRepository from "#/accounts/accounts.repository";
import type { AccountType } from "#/admin/admin.types";
import { PathsV1 } from "#/common/paths";
import type { AppBindings, AppContext } from "#/env";

type Routes = {
  path: string;
  method: "GET" | "POST" | "DELETE";
}[];

export function isPublicPath(reqPath: string, reqMethod: string): boolean {
  // this is in the function because otherwise there are import resolution
  // order issues and some values end up as undefined
  const publicPaths: Routes = [
    { path: PathsV1.system.health, method: "GET" },
    { path: PathsV1.system.about, method: "GET" },
    { path: PathsV1.docs, method: "GET" },
    { path: PathsV1.accounts.root, method: "POST" },
    { path: PathsV1.accounts.publicKey, method: "POST" },
  ];

  return publicPaths.some(({ path, method }) => {
    return method === reqMethod && reqPath.startsWith(path);
  });
}

export function useAuthMiddleware(bindings: AppBindings): MiddlewareHandler {
  const { log } = bindings;

  return async (c: AppContext, next: Next) => {
    try {
      if (isPublicPath(c.req.path, c.req.method)) {
        return next();
      }

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
      // throws on invalid signature
      envelope.validateSignatures();

      const { token } = envelope.token;
      // TODO: attenuation enforcement to follow
      const isNilDbCommand = token.command.isAttenuationOf(
        new Command(["nil", "db"]),
      );

      if (!token || !isNilDbCommand) {
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

export function isRoleAllowed(
  c: AppContext,
  permitted: AccountType[],
): boolean {
  const {
    var: { account },
    env: { log },
  } = c;

  const allowed = permitted.includes(account._type);
  if (!allowed) {
    log.warn(
      `Unauthorized(account=${account._id},type=${account._type},path=${c.req.path}`,
    );
  }

  return allowed;
}
