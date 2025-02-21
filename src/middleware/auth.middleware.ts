import * as didJwt from "did-jwt";
import { Resolver } from "did-resolver";
import type { MiddlewareHandler, Next } from "hono";
import { StatusCodes, getReasonPhrase } from "http-status-codes";
import type { AccountType } from "#/admin/admin.types";
import { NilDid, buildNilMethodResolver } from "#/common/nil-did";
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
  const resolver = new Resolver({
    nil: buildNilMethodResolver(bindings).resolve,
  });

  return async (c: AppContext, next: Next) => {
    try {
      if (isPublicPath(c.req.path, c.req.method)) {
        return next();
      }

      const authHeader = c.req.header("Authorization") ?? "";
      const [scheme, token] = authHeader.split(" ");
      if (scheme.toLowerCase() !== "bearer") {
        return c.text(
          getReasonPhrase(StatusCodes.UNAUTHORIZED),
          StatusCodes.UNAUTHORIZED,
        );
      }

      const { payload } = await didJwt.verifyJWT(token, {
        audience: bindings.node.identity.did,
        resolver,
      });

      if (!payload) {
        return c.text(
          getReasonPhrase(StatusCodes.UNAUTHORIZED),
          StatusCodes.UNAUTHORIZED,
        );
      }

      // should be a cache hit because the resolver primes the cache else it fails
      const account = c.env.cache.accounts.get(NilDid.parse(payload.iss));
      if (!account) {
        c.env.log.debug("Expected account not in cache: %s", payload.iss);
        return c.text(
          getReasonPhrase(StatusCodes.INTERNAL_SERVER_ERROR),
          StatusCodes.INTERNAL_SERVER_ERROR,
        );
      }

      c.set("jwt", payload);
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
