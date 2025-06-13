import { prometheus } from "@hono/prometheus";
import { Effect as E, pipe } from "effect";
import { Hono } from "hono";
import { describeRoute, openAPISpecs } from "hono-openapi";
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
import { FeatureFlag, hasFeatureFlag } from "#/env";
import {
  enforceCapability,
  loadNucToken,
  loadSubjectAndVerifyAsAdmin,
} from "#/middleware/capability.middleware";
import packageJson from "../../package.json";
import {
  HealthCheckResponse,
  ReadAboutNodeResponse,
  ReadLogLevelResponse,
  SetLogLevelRequest,
  SetLogLevelResponse,
  StartMaintenanceResponse,
  StopMaintenanceResponse,
} from "./system.dto";
import { SystemDataMapper } from "./system.mapper";
import * as SystemService from "./system.services";

/**
 * Handle GET /about
 */
export function readAboutNode(options: ControllerOptions): void {
  const { app } = options;

  app.get(
    PathsV1.system.about,
    describeRoute({
      tags: ["System"],
      summary: "Get node identity and status",
      responses: {
        200: {
          description: "OK",
          content: {
            "application/json": {
              schema: resolver(ReadAboutNodeResponse),
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
          c.json<ReadAboutNodeResponse>(
            SystemDataMapper.toGetAboutNodeResponse(nodeInfo),
          ),
        ),
        handleTaggedErrors(c),
        E.runPromise,
      );
    },
  );
}

/**
 * Handle GET /health
 */
export function readNodeHealth(options: ControllerOptions): void {
  const { app } = options;

  app.get(
    PathsV1.system.health,
    describeRoute({
      tags: ["System"],
      summary: "Health check",
      responses: {
        200: {
          description: "OK",
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
 * Handle GET /metrics
 */
export function getMetrics(options: ControllerOptions): {
  metrics: Hono | undefined;
} {
  const {
    app,
    bindings: { log },
  } = options;

  const enabled = hasFeatureFlag(
    options.bindings.config.enabledFeatures,
    FeatureFlag.METRICS,
  );

  if (!enabled) {
    log.info("The metrics feature is disabled");
    return { metrics: undefined };
  }

  const metrics = new Hono();
  const { printMetrics, registerMetrics } = prometheus();
  app.use("*", registerMetrics);

  metrics.get(PathsV1.system.metrics, printMetrics);

  return { metrics };
}

/**
 * Handle GET /openapi.json
 */
export function getOpenApiJson(options: ControllerOptions): void {
  const {
    app,
    bindings: { log },
  } = options;

  const enabled = hasFeatureFlag(
    options.bindings.config.enabledFeatures,
    FeatureFlag.OPENAPI,
  );

  if (!enabled) {
    log.info("The openapi feature is disabled");
    return;
  }

  app.get(
    PathsV1.system.openApiJson,
    openAPISpecs(app, {
      documentation: {
        info: {
          title: "nilDB API",
          version: packageJson.version,
          description:
            "nilDB is a privacy-focused data storage and querying service built for the Nillion Network. It combines schema-validated storage, MongoDB-style aggregation pipelines, and capability-based access control (UCAN) to enable truly user-owned data. Designed to integrate with Nillion's blind computation modules and SDKs, nilDB empowers developers to build applications where users maintain full control and privacy over their data.",
        },
      },
    }),
  );
}

/**
 * Handle POST /v1/system/maintenance/start
 */
export function startMaintenance(options: ControllerOptions): void {
  const { app, bindings } = options;
  const path = PathsV1.system.maintenanceStart;

  app.post(
    path,
    describeRoute({
      tags: ["System"],
      security: [{ bearerAuth: [] }],
      summary: "Start maintenance mode",
      responses: {
        200: OpenApiSpecEmptySuccessResponses["200"],
        ...OpenApiSpecCommonErrorResponses,
      },
    }),
    loadNucToken(bindings),
    loadSubjectAndVerifyAsAdmin(bindings),
    enforceCapability({
      cmd: NucCmd.nil.db.system.update,
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
 * Handle POST /v1/system/maintenance/stop
 */
export function stopMaintenance(options: ControllerOptions): void {
  const { app, bindings } = options;
  const path = PathsV1.system.maintenanceStop;

  app.post(
    path,
    describeRoute({
      tags: ["System"],
      security: [{ bearerAuth: [] }],
      summary: "Stop maintenance mode",
      responses: {
        200: OpenApiSpecEmptySuccessResponses["200"],
        ...OpenApiSpecCommonErrorResponses,
      },
    }),
    loadNucToken(bindings),
    loadSubjectAndVerifyAsAdmin(bindings),
    enforceCapability({
      cmd: NucCmd.nil.db.system.update,
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
 * Handle POST /v1/system/log-level
 */
export function setLogLevel(options: ControllerOptions): void {
  const { app, bindings } = options;
  const path = PathsV1.system.logLevel;

  app.post(
    path,
    describeRoute({
      tags: ["System"],
      security: [{ bearerAuth: [] }],
      summary: "Set log level",
      responses: {
        200: OpenApiSpecEmptySuccessResponses["200"],
        ...OpenApiSpecCommonErrorResponses,
      },
    }),
    zValidator("json", SetLogLevelRequest),
    loadNucToken(bindings),
    loadSubjectAndVerifyAsAdmin(bindings),
    enforceCapability<{ json: SetLogLevelRequest }>({
      cmd: NucCmd.nil.db.system.update,
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
 * Handle GET /v1/system/log-level
 */
export function readLogLevel(options: ControllerOptions): void {
  const { app, bindings } = options;
  const path = PathsV1.system.logLevel;

  app.get(
    path,
    describeRoute({
      tags: ["System"],
      security: [{ bearerAuth: [] }],
      summary: "Read log level",
      responses: {
        200: {
          description: "OK",
          content: {
            "application/json": {
              schema: resolver(ReadLogLevelResponse),
            },
          },
        },
        ...OpenApiSpecCommonErrorResponses,
      },
    }),
    loadNucToken(bindings),
    loadSubjectAndVerifyAsAdmin(bindings),
    enforceCapability({
      cmd: NucCmd.nil.db.system.read,
      validate: (_c, _token) => true,
    }),
    async (c) => {
      const level = c.env.log.level as LogLevel;

      return c.json<ReadLogLevelResponse>(
        SystemDataMapper.toGetLogLevelResponse(level),
      );
    },
  );
}
