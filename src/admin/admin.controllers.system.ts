import { Effect as E, pipe } from "effect";
import { StatusCodes } from "http-status-codes";
import { handleTaggedErrors } from "#/common/handler";
import { PathsV1 } from "#/common/paths";
import { payloadValidator } from "#/common/zod-utils";
import * as SystemService from "#/system/system.services";
import {
  AdminSetLogLevelRequestSchema,
  AdminSetMaintenanceWindowRequestSchema,
  type LogLevelInfo,
} from "./admin.types";
import type { ControllerOptions } from "#/common/types";
import { NucCmd } from "#/common/nuc-cmd-tree";
import {
  enforceCapability,
  RoleSchema,
  verifyNucAndLoadSubject,
} from "#/middleware/capability.middleware";
import type { AppContext } from "#/env";
import type { NucToken } from "@nillion/nuc";

export function setMaintenanceWindow(options: ControllerOptions): void {
  const { app, bindings } = options;
  const path = PathsV1.admin.system.maintenance;
  const guard = {
    path,
    cmd: NucCmd.nil.db.admin,
    roles: [RoleSchema.enum.admin],
    // TODO: implement policy validation fix json on body type inference
    validate: (_c: AppContext, _token: NucToken) => true,
  };

  app.post(
    path,
    payloadValidator(AdminSetMaintenanceWindowRequestSchema),
    verifyNucAndLoadSubject(bindings),
    enforceCapability(bindings, guard),
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
  const path = PathsV1.admin.system.maintenance;
  const guard = {
    path,
    cmd: NucCmd.nil.db.admin,
    roles: [RoleSchema.enum.admin],
    // TODO: implement policy validation fix json on body type inference
    validate: (_c: AppContext, _token: NucToken) => true,
  };

  app.delete(
    path,
    verifyNucAndLoadSubject(bindings),
    enforceCapability(bindings, guard),
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
  const path = PathsV1.admin.system.logLevel;
  const guard = {
    path,
    cmd: NucCmd.nil.db.admin,
    roles: [RoleSchema.enum.admin],
    // TODO: implement policy validation fix json on body type inference
    validate: (_c: AppContext, _token: NucToken) => true,
  };

  app.post(
    path,
    verifyNucAndLoadSubject(bindings),
    enforceCapability(bindings, guard),
    payloadValidator(AdminSetLogLevelRequestSchema),
    async (c) => {
      const payload = c.req.valid("json");
      c.env.log.level = payload.level;
      return new Response(null, { status: StatusCodes.OK });
    },
  );
}

export function getLogLevel(options: ControllerOptions): void {
  const { app, bindings } = options;
  const path = PathsV1.admin.system.logLevel;
  const guard = {
    path,
    cmd: NucCmd.nil.db.admin,
    roles: [RoleSchema.enum.admin],
    // TODO: implement policy validation fix json on body type inference
    validate: (_c: AppContext, _token: NucToken) => true,
  };

  app.get(
    path,
    verifyNucAndLoadSubject(bindings),
    enforceCapability(bindings, guard),
    async (c) => {
      const logLevelInfo = {
        level: c.env.log.level,
        levelValue: c.env.log.levelVal,
      } as LogLevelInfo;
      return c.json(logLevelInfo);
    },
  );
}
