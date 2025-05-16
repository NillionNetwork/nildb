import { Effect as E, pipe } from "effect";
import { StatusCodes } from "http-status-codes";
import { handleTaggedErrors } from "#/common/handler";
import { NucCmd } from "#/common/nuc-cmd-tree";
import { PathsV1 } from "#/common/paths";
import type { ControllerOptions } from "#/common/types";
import { payloadValidator } from "#/common/zod-utils";
import {
  enforceCapability,
  RoleSchema,
  verifyNucAndLoadSubject,
} from "#/middleware/capability.middleware";
import * as QueriesService from "#/queries/queries.services";
import {
  type DeleteQueryRequest,
  DeleteQueryRequestSchema,
  type ExecuteQueryRequest,
  ExecuteQueryRequestSchema,
  type QueryJobRequest,
  QueryJobRequestSchema,
} from "#/queries/queries.types";
import {
  type AdminAddQueryRequest,
  AdminAddQueryRequestSchema,
} from "./admin.types";

export function add(options: ControllerOptions): void {
  const { app, bindings } = options;
  const path = PathsV1.admin.queries.root;

  app.post(
    path,
    payloadValidator(AdminAddQueryRequestSchema),
    verifyNucAndLoadSubject(bindings),
    enforceCapability<{ json: AdminAddQueryRequest }>({
      path,
      cmd: NucCmd.nil.db.admin,
      roles: [RoleSchema.enum.admin],
      validate: (_c, _token) => true,
    }),
    async (c) => {
      const payload = c.req.valid("json");

      return pipe(
        QueriesService.addQuery(c.env, payload),
        E.map(() => new Response(null, { status: StatusCodes.CREATED })),
        handleTaggedErrors(c),
        E.runPromise,
      );
    },
  );
}

export function remove(options: ControllerOptions): void {
  const { app, bindings } = options;
  const path = PathsV1.admin.queries.root;

  app.delete(
    path,
    payloadValidator(DeleteQueryRequestSchema),
    verifyNucAndLoadSubject(bindings),
    enforceCapability<{ json: DeleteQueryRequest }>({
      path,
      cmd: NucCmd.nil.db.admin,
      roles: [RoleSchema.enum.admin],
      validate: (_c, _token) => true,
    }),
    async (c) => {
      const payload = c.req.valid("json");

      return pipe(
        QueriesService.removeQuery(c.env, payload.id),
        E.map(() => new Response(null, { status: StatusCodes.CREATED })),
        handleTaggedErrors(c),
        E.runPromise,
      );
    },
  );
}

export function execute(options: ControllerOptions): void {
  const { app, bindings } = options;
  const path = PathsV1.admin.queries.execute;

  app.post(
    path,
    payloadValidator(ExecuteQueryRequestSchema),
    verifyNucAndLoadSubject(bindings),
    enforceCapability<{ json: ExecuteQueryRequest }>({
      path,
      cmd: NucCmd.nil.db.admin,
      roles: [RoleSchema.enum.admin],
      validate: (_c, _token) => true,
    }),
    async (c) => {
      const payload = c.req.valid("json");

      return pipe(
        QueriesService.executeQuery(c.env, payload),
        E.map((data) => c.json({ data })),
        handleTaggedErrors(c),
        E.runPromise,
      );
    },
  );
}

export function getQueryJob(options: ControllerOptions): void {
  const { app, bindings } = options;
  const path = PathsV1.admin.queries.job;

  app.post(
    path,
    payloadValidator(QueryJobRequestSchema),
    verifyNucAndLoadSubject(bindings),
    enforceCapability<{ json: QueryJobRequest }>({
      path,
      cmd: NucCmd.nil.db.admin,
      roles: [RoleSchema.enum.admin],
      validate: (_c, _token) => true,
    }),
    async (c) => {
      const payload = c.req.valid("json");

      return pipe(
        QueriesService.findQueryJob(c.env, payload.id),
        E.map((data) => c.json({ data })),
        handleTaggedErrors(c),
        E.runPromise,
      );
    },
  );
}
