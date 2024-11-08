import { Effect as E } from "effect";
import type { Hono } from "hono";
import type { AppEnv } from "#/app";
import { listOrgSchemas } from "#/models/schemas";
import { findRootError } from "#/utils";

export type ListSchemasPath = "/api/v1/orgs/schemas";

export function handleListSchemas(
  app: Hono<AppEnv>,
  path: ListSchemasPath,
): void {
  app.get(path, (c) => {
    return E.Do.pipe(
      E.let("orgId", () => c.get("jwtPayload").sub),
      E.flatMap(({ orgId }) => listOrgSchemas(orgId)),
      E.match({
        onFailure: (e) => {
          const status = findRootError(e, "list schemas", c.var.log);
          return c.text("", status);
        },
        onSuccess: (data) => {
          return c.json({ data });
        },
      }),
      E.runPromise,
    );
  });
}
