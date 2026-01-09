import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import type { CollectionNotFoundError, DatabaseError } from "@nildb/common/errors";
import type { AppBindings } from "@nildb/env";
import { Effect as E, pipe } from "effect";

import * as SystemRepository from "./system.repository.js";
import type {
  AboutNode,
  BuildInfo,
  MaintenanceInfo,
  SetLogLevelCommand,
  StartMaintenanceCommand,
  StopMaintenanceCommand,
} from "./system.types.js";

const started = new Date();
let buildInfo: BuildInfo;

/**
 * Get node information.
 */
export function getNodeInfo(ctx: AppBindings): E.Effect<AboutNode, CollectionNotFoundError | DatabaseError> {
  const { node } = ctx;

  return pipe(
    getMaintenanceStatus(ctx),
    E.map((maintenance) => ({
      started,
      build: getBuildInfo(ctx),
      publicKey: node.publicKey,
      url: node.endpoint,
      maintenance,
    })),
  );
}

/**
 * Get build information.
 */
function getBuildInfo(ctx: AppBindings): BuildInfo {
  if (buildInfo) {
    return buildInfo;
  }

  try {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const buildInfoPath = path.join(__dirname, "../../../buildinfo.json");
    const content = fs.readFileSync(buildInfoPath, "utf-8");
    return JSON.parse(content) as BuildInfo;
  } catch {
    ctx.log.info("No buildinfo.json found using fallback values");
    buildInfo = {
      time: "1970-01-01T00:00:00Z",
      commit: "unknown",
      version: "0.0.0",
    };
    return buildInfo;
  }
}

/**
 * Set node log level.
 */
export function setLogLevel(ctx: AppBindings, command: SetLogLevelCommand): E.Effect<void, never> {
  return E.sync(() => {
    ctx.log.level = command.level;
    ctx.log.info(`Log level set to: ${command.level}`);
  });
}

/**
 * Start maintenance mode.
 */
export function startMaintenance(
  ctx: AppBindings,
  _command: StartMaintenanceCommand,
): E.Effect<void, CollectionNotFoundError | DatabaseError> {
  return pipe(
    SystemRepository.startMaintenance(ctx),
    E.tap(() => ctx.log.info("Maintenance mode started")),
  );
}

/**
 * Stop maintenance mode.
 */
export function stopMaintenance(
  ctx: AppBindings,
  _command: StopMaintenanceCommand,
): E.Effect<void, CollectionNotFoundError | DatabaseError> {
  return pipe(
    SystemRepository.stopMaintenance(ctx),
    E.tap(() => ctx.log.info("Maintenance mode stopped")),
  );
}

/**
 * Get maintenance status.
 */
export function getMaintenanceStatus(
  ctx: AppBindings,
): E.Effect<MaintenanceInfo, CollectionNotFoundError | DatabaseError> {
  return pipe(
    SystemRepository.findMaintenanceConfig(ctx),
    E.map((document) =>
      document ? { active: true, startedAt: document.startedAt } : { active: false, startedAt: new Date(0) },
    ),
  );
}
