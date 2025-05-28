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
import * as SystemService from "#/system/system.services";
import {
  type AdminSetLogLevelRequest,
  AdminSetLogLevelRequestSchema,
  type AdminSetMaintenanceWindowRequest,
  AdminSetMaintenanceWindowRequestSchema,
  type LogLevelInfo,
} from "./admin.types";

export function setMaintenanceWindow(options: ControllerOptions): void {
  const { app, bindings } = options;
  const path = PathsV1.admin.maintenance;

  app.post(
    path,
    payloadValidator(AdminSetMaintenanceWindowRequestSchema),
    verifyNucAndLoadSubject(bindings),
    enforceCapability<{ json: AdminSetMaintenanceWindowRequest }>({
      path,
      cmd: NucCmd.nil.db.admin,
      roles: [RoleSchema.enum.root],
      validate: (_c, _token) => true,
    }),
    async (c) => {
      const payload = c.req.valid("json");
      return pipe(
        SystemService.setMaintenanceWindow(c.env, payload),
        E.map(() => new Response(null, { status: StatusCodes.OK })),
        handleTaggedErrors(c),
        E.runPromise,
      );
    },
  );
}

export function deleteMaintenanceWindow(options: ControllerOptions): void {
  const { app, bindings } = options;
  const path = PathsV1.admin.maintenance;

  app.delete(
    path,
    verifyNucAndLoadSubject(bindings),
    enforceCapability({
      path,
      cmd: NucCmd.nil.db.admin,
      roles: [RoleSchema.enum.root],
      validate: (_c, _token) => true,
    }),
    async (c) =>
      pipe(
        SystemService.deleteMaintenanceWindow(c.env),
        E.map(() => new Response(null, { status: StatusCodes.NO_CONTENT })),
        handleTaggedErrors(c),
        E.runPromise,
      ),
  );
}

export function setLogLevel(options: ControllerOptions): void {
  const { app, bindings } = options;
  const path = PathsV1.admin.logLevel;

  app.post(
    path,
    payloadValidator(AdminSetLogLevelRequestSchema),
    verifyNucAndLoadSubject(bindings),
    enforceCapability<{ json: AdminSetLogLevelRequest }>({
      path,
      cmd: NucCmd.nil.db.admin,
      roles: [RoleSchema.enum.root],
      validate: (_c, _token) => true,
    }),
    async (c) => {
      const payload = c.req.valid("json");
      c.env.log.level = payload.level;
      return new Response(null, { status: StatusCodes.OK });
    },
  );
}

export function getLogLevel(options: ControllerOptions): void {
  const { app, bindings } = options;
  const path = PathsV1.admin.logLevel;

  app.get(
    path,
    verifyNucAndLoadSubject(bindings),
    enforceCapability({
      path,
      cmd: NucCmd.nil.db.admin,
      roles: [RoleSchema.enum.root],
      validate: (_c, _token) => true,
    }),
    async (c) => {
      const logLevelInfo = {
        level: c.env.log.level,
        levelValue: c.env.log.levelVal,
      } as LogLevelInfo;
      return c.json(logLevelInfo);
    },
  );
}
