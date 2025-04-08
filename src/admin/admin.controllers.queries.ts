import type { NucToken } from "@nillion/nuc";
import { Effect as E, pipe } from "effect";
import { StatusCodes } from "http-status-codes";
import { handleTaggedErrors } from "#/common/handler";
import { NucCmd } from "#/common/nuc-cmd-tree";
import { PathsV1 } from "#/common/paths";
import type { ControllerOptions } from "#/common/types";
import { payloadValidator } from "#/common/zod-utils";
import type { AppContext } from "#/env";
import {
  RoleSchema,
  enforceCapability,
  verifyNucAndLoadSubject,
} from "#/middleware/capability.middleware";
import * as QueriesService from "#/queries/queries.services";
import {
  DeleteQueryRequestSchema,
  ExecuteQueryRequestSchema,
} from "#/queries/queries.types";
import { AdminAddQueryRequestSchema } from "./admin.types";

export function add(options: ControllerOptions): void {
  const { app, bindings } = options;
  const path = PathsV1.admin.queries.root;
  const guard = {
    path,
    cmd: NucCmd.nil.db.admin,
    roles: [RoleSchema.enum.admin],
    // TODO: implement policy validation fix json on body type inference
    validate: (_c: AppContext, _token: NucToken) => true,
  };

  app.post(
    path,
    payloadValidator(AdminAddQueryRequestSchema),
    verifyNucAndLoadSubject(bindings),
    enforceCapability(bindings, guard),
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
  const guard = {
    path,
    cmd: NucCmd.nil.db.admin,
    roles: [RoleSchema.enum.admin],
    // TODO: implement policy validation fix json on body type inference
    validate: (_c: AppContext, _token: NucToken) => true,
  };

  app.delete(
    path,
    payloadValidator(DeleteQueryRequestSchema),
    verifyNucAndLoadSubject(bindings),
    enforceCapability(bindings, guard),
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
  const guard = {
    path,
    cmd: NucCmd.nil.db.admin,
    roles: [RoleSchema.enum.admin],
    // TODO: implement policy validation fix json on body type inference
    validate: (_c: AppContext, _token: NucToken) => true,
  };

  app.post(
    path,
    payloadValidator(ExecuteQueryRequestSchema),
    verifyNucAndLoadSubject(bindings),
    enforceCapability(bindings, guard),
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
