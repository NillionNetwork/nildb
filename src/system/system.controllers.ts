import { Effect as E, pipe } from "effect";
import { describeRoute } from "hono-openapi";
import { resolver, validator as zValidator } from "hono-openapi/zod";
import { handleTaggedErrors } from "#/common/handler";
import type { LogLevel } from "#/common/logger";
import { NucCmd } from "#/common/nuc-cmd-tree";
import {
  OpenApiSpecCommonErrorResponses,
  OpenApiSpecEmptySuccessResponses,
} from "#/common/openapi";
import { PathsV1 } from "#/common/paths";
import type { ControllerOptions } from "#/common/types";
import {
  enforceCapability,
  loadNucToken,
  loadSubjectAndVerifyAsAdmin,
} from "#/middleware/capability.middleware";
import {
  GetAboutNodeResponse,
  GetLogLevelResponse,
  HealthCheckResponse,
  SetLogLevelRequest,
  SetLogLevelResponse,
  StartMaintenanceResponse,
  StopMaintenanceResponse,
} from "./system.dto";
import { SystemDataMapper } from "./system.mapper";
import * as SystemService from "./system.services";

export function aboutNode(options: ControllerOptions): void {
  const { app } = options;

  app.get(
    PathsV1.system.about,
    describeRoute({
      tags: ["System"],
      summary: "Get node information",
      description:
        "Retrieves comprehensive information about the node including build details, identity, and maintenance status.",
      responses: {
        200: {
          description: "Node information retrieved",
          content: {
            "application/json": {
              schema: resolver(GetAboutNodeResponse),
            },
          },
        },
        ...OpenApiSpecCommonErrorResponses,
      },
    }),
    async (c) => {
      return await pipe(
        SystemService.getNodeInfo(c.env),
        E.map((nodeInfo) =>
          c.json<GetAboutNodeResponse>(
            SystemDataMapper.toGetAboutNodeResponse(nodeInfo),
          ),
        ),
        handleTaggedErrors(c),
        E.runPromise,
      );
    },
  );
}

export function healthCheck(options: ControllerOptions): void {
  const { app } = options;

  app.get(
    PathsV1.system.health,
    describeRoute({
      tags: ["System"],
      summary: "Health check",
      description:
        "Performs a simple health check to verify the service is responding.",
      responses: {
        200: {
          description: "Service is healthy",
          content: {
            "text/plain": {
              schema: {
                type: "string",
                example: "OK",
              },
            },
          },
        },
      },
    }),
    async (_c) => HealthCheckResponse,
  );
}

/**
 * Registers the start maintenance endpoint.
 *
 * Allows root users to immediately start maintenance mode.
 *
 * @param options - Controller configuration including app instance and bindings
 */
export function startMaintenance(options: ControllerOptions): void {
  const { app, bindings } = options;
  const path = PathsV1.system.maintenanceStart;

  app.post(
    path,
    describeRoute({
      tags: ["Admin"],
      security: [{ bearerAuth: [] }],
      summary: "Start maintenance mode",
      description:
        "Activates maintenance mode immediately. The system will reject incoming requests while in maintenance mode.",
      responses: {
        200: OpenApiSpecEmptySuccessResponses["200"],
        ...OpenApiSpecCommonErrorResponses,
      },
    }),
    loadNucToken(bindings),
    loadSubjectAndVerifyAsAdmin(bindings),
    enforceCapability({
      path,
      cmd: NucCmd.nil.db.admin,
      validate: (_c, _token) => true,
    }),
    async (c) => {
      const command = SystemDataMapper.toStartMaintenanceCommand();

      return pipe(
        SystemService.startMaintenance(c.env, command),
        E.map(() => StartMaintenanceResponse),
        handleTaggedErrors(c),
        E.runPromise,
      );
    },
  );
}

/**
 * Registers the stop maintenance endpoint.
 *
 * Allows root users to stop maintenance mode and resume normal operations.
 *
 * @param options - Controller configuration including app instance and bindings
 */
export function stopMaintenance(options: ControllerOptions): void {
  const { app, bindings } = options;
  const path = PathsV1.system.maintenanceStop;

  app.post(
    path,
    describeRoute({
      tags: ["Admin"],
      security: [{ bearerAuth: [] }],
      summary: "Stop maintenance mode",
      description:
        "Deactivates maintenance mode and resumes normal operations.",
      responses: {
        200: OpenApiSpecEmptySuccessResponses["200"],
        ...OpenApiSpecCommonErrorResponses,
      },
    }),
    loadNucToken(bindings),
    loadSubjectAndVerifyAsAdmin(bindings),
    enforceCapability({
      path,
      cmd: NucCmd.nil.db.admin,
      validate: (_c, _token) => true,
    }),
    async (c) => {
      const command = SystemDataMapper.toStopMaintenanceCommand();

      return pipe(
        SystemService.stopMaintenance(c.env, command),
        E.map(() => StopMaintenanceResponse),
        handleTaggedErrors(c),
        E.runPromise,
      );
    },
  );
}

/**
 * Registers the set log level endpoint.
 *
 * Allows admins to dynamically adjust the Api's log level.
 *
 * @param options - Controller configuration including app instance and bindings
 */
export function setLogLevel(options: ControllerOptions): void {
  const { app, bindings } = options;
  const path = PathsV1.system.logLevel;

  app.post(
    path,
    describeRoute({
      tags: ["Admin"],
      security: [{ bearerAuth: [] }],
      summary: "Set log level",
      description: "Dynamically sets the API's log level.",
      responses: {
        200: OpenApiSpecEmptySuccessResponses["200"],
        ...OpenApiSpecCommonErrorResponses,
      },
    }),
    zValidator("json", SetLogLevelRequest),
    loadNucToken(bindings),
    loadSubjectAndVerifyAsAdmin(bindings),
    enforceCapability<{ json: SetLogLevelRequest }>({
      path,
      cmd: NucCmd.nil.db.admin,
      validate: (_c, _token) => true,
    }),
    async (c) => {
      const payload = c.req.valid("json");
      const command = SystemDataMapper.toSetLogLevelCommand(payload);

      return pipe(
        SystemService.setLogLevel(c.env, command),
        E.map(() => SetLogLevelResponse),
        handleTaggedErrors(c),
        E.runPromise,
      );
    },
  );
}

/**
 * Registers the read log level endpoint.
 *
 * Allows admins to read the Api's current log level.
 *
 * @param options - Controller configuration including app instance and bindings
 */
export function getLogLevel(options: ControllerOptions): void {
  const { app, bindings } = options;
  const path = PathsV1.system.logLevel;

  app.get(
    path,
    describeRoute({
      tags: ["Admin"],
      security: [{ bearerAuth: [] }],
      summary: "Get the Api's log level",
      description: "Retrieves the current API log level.",
      responses: {
        200: {
          description: "Log level retrieved",
          content: {
            "application/json": {
              schema: resolver(GetLogLevelResponse),
            },
          },
        },
        ...OpenApiSpecCommonErrorResponses,
      },
    }),
    loadNucToken(bindings),
    loadSubjectAndVerifyAsAdmin(bindings),
    enforceCapability({
      path,
      cmd: NucCmd.nil.db.admin,
      validate: (_c, _token) => true,
    }),
    async (c) => {
      const level = c.env.log.level as LogLevel;

      return c.json<GetLogLevelResponse>(
        SystemDataMapper.toGetLogLevelResponse(level),
      );
    },
  );
}
