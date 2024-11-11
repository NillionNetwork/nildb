import Ajv from "ajv";
import { Effect as E } from "effect";
import type { Hono } from "hono";
import { z } from "zod";
import type { AppEnv } from "#/app";
import { insertSchemaData, listOrgSchemas } from "#/models/schemas";
import { findRootError } from "#/utils";

export const RunQueryReqBody = z.object({
  schemaName: z.string().length(17),
  data: z.array(z.record(z.unknown())),
});
export type RunQueryReqBody = z.infer<typeof RunQueryReqBody>;

export type UploadDataPath = "/api/v1/data/upload";

export function handleUploadData(
  app: Hono<AppEnv>,
  path: UploadDataPath,
): void {
  app.post(path, (c) => {
    return E.Do.pipe(
      E.let("orgId", () => c.get("jwtPayload").sub),
      E.bind("reqBody", () =>
        E.tryPromise(async () => {
          const raw = await c.req.json<unknown>();
          return RunQueryReqBody.parse(raw);
        }),
      ),
      E.flatMap(({ orgId, reqBody }) =>
        E.tryPromise(async () => {
          const schemas = await listOrgSchemas(orgId).pipe(E.runPromise);
          const record = schemas.find((s) => s.id === reqBody.schemaName)!;
          const schema =
            typeof record.schema === "string"
              ? JSON.parse(record.schema)
              : record.schema;
          const ajv = new Ajv({ strict: "log" });
          const validator = ajv.compile(schema);

          const valid = validator(reqBody.data);

          if (!valid) {
            c.var.log.warn("Uploaded schema data failed validation");
            throw new Error("Upload data failed schema validation", {
              cause: validator.errors,
            });
          }

          return await insertSchemaData(
            c.var.db.mongo,
            reqBody.schemaName,
            reqBody.data as unknown as object[],
          ).pipe(E.runPromise);
        }),
      ),
      E.match({
        onFailure: (e) => {
          const status = findRootError(e, "upload data", c.var.log);
          return c.text("", status);
        },
        onSuccess: (name) => {
          c.var.log.info(`Schema data uploaded to ${name}`);
          return c.text("", 200);
        },
      }),
      E.runPromise,
    );
  });
}
