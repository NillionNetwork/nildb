import { Effect as E } from "effect";
import type { Hono } from "hono";
import { z } from "zod";
import type { AppEnv } from "#/app";
import { deleteSchemaData } from "#/models/schemas";
import { findRootError } from "#/utils";

export const DeleteDataReqBody = z.object({
  schemaName: z.string(),
  keyName: z.string(),
  entriesToDelete: z.array(z.union([z.string(), z.number()])),
});
export type DeleteDataReqBody = z.infer<typeof DeleteDataReqBody>;

export type DeleteDataPath = "/api/v1/data/delete";

export function handleDeleteData(
  app: Hono<AppEnv>,
  path: DeleteDataPath,
): void {
  app.delete(path, (c) => {
    return E.Do.pipe(
      E.let("orgId", () => c.get("jwtPayload").sub),
      E.bind("reqBody", () =>
        E.tryPromise(async () => {
          const raw = await c.req.json<unknown>();
          return DeleteDataReqBody.parse(raw);
        }),
      ),
      E.flatMap(({ reqBody }) => {
        const filter = {
          [reqBody.keyName]: { $in: reqBody.entriesToDelete },
        };
        return deleteSchemaData(c.var.db.mongo, reqBody.schemaName, filter);
      }),
      E.match({
        onFailure: (e) => {
          const status = findRootError(e, "delete data", c.var.log);
          return c.text("", status);
        },
        onSuccess: (name) => {
          c.var.log.info(`Deleted data from collection ${name}`);
          return c.text("", 200);
        },
      }),
      E.runPromise,
    );
  });
}
