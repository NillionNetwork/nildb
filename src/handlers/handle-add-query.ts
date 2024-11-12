import Ajv from "ajv";
import { Effect as E } from "effect";
import type { Hono } from "hono";
import { z } from "zod";
import type { AppEnv } from "#/app";
import pipelineSchema from "#/models/mongodb_pipeline.json";
import { findOrgById } from "#/models/orgs";
import { addOrgQueryRecord } from "#/models/queries";
import { createShortId, findRootError } from "#/utils";

export const AddQueryReqBody = z.object({
  schemaName: z.string(),
  description: z.string(),
  pipeline: z.array(z.unknown()),
});
export type AddQueryReqBody = z.infer<typeof AddQueryReqBody>;

export type AddQueryPath = "/api/v1/orgs/queries";

export function handleAddQuery(app: Hono<AppEnv>, path: AddQueryPath): void {
  app.post(path, (c) => {
    return E.Do.pipe(
      E.let("orgId", () => c.get("jwtPayload").sub),
      E.bind("reqBody", () =>
        E.tryPromise(async () => {
          const raw = await c.req.json<unknown>();
          return AddQueryReqBody.parse(raw);
        }),
      ),
      E.bind("body", ({ orgId, reqBody }) =>
        E.tryPromise(async () => {
          const ajv = new Ajv({ strict: "log" });
          const validator = ajv.compile(pipelineSchema);
          const valid = validator(reqBody.pipeline);

          if (!valid) {
            c.var.log.warn("Uploaded query failed schema validation");
            throw new Error("Upload query failed schema validation", {
              cause: validator.errors,
            });
          }

          const org = await findOrgById(orgId).pipe(E.runPromise);
          const prefix = org.prefix;

          const id = createShortId(5);
          return {
            queryName: `${prefix}_query_${id}`,
            queryDescription: reqBody.description,
            pipeline: JSON.stringify(reqBody.pipeline),
            startingSchema: reqBody.schemaName,
          };
        }),
      ),
      E.bind("org", ({ orgId, body }) =>
        addOrgQueryRecord(
          orgId,
          body.queryName,
          body.queryDescription,
          body.pipeline,
          body.startingSchema,
        ),
      ),
      E.match({
        onFailure: (e) => {
          const status = findRootError(e, "add query", c.var.log);
          return c.text("", status);
        },
        onSuccess: (result) => {
          const { queryName } = result.body;
          c.var.log.info(`Query added: ${queryName}`);
          return c.text(queryName, 201);
        },
      }),
      E.runPromise,
    );
  });
}
