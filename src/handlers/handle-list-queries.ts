import { Effect as E } from "effect";
import type { Hono } from "hono";
import type { AppEnv } from "#/app";
import { listOrgQueries } from "#/models/queries";
import { findRootError } from "#/utils";

export type ListQueriesPath = "/api/v1/orgs/queries";

export function handleListQueries(
  app: Hono<AppEnv>,
  path: ListQueriesPath,
): void {
  app.get(path, async (c) => {
    return E.Do.pipe(
      E.let("orgId", () => c.get("jwtPayload").sub),
      E.flatMap(({ orgId }) => listOrgQueries(orgId)),
      E.match({
        onFailure: (e) => {
          const status = findRootError(e, "list queries", c.var.log);
          return c.text("", status);
        },
        onSuccess: (queries) => {
          const data = Array.from(queries.entries()).map(([name, value]) => ({
            name,
            pipeline: value.pipeline,
            schema: value.schema,
          }));
          return c.json({ data });
        },
      }),
      E.runPromise,
    );
  });
}
