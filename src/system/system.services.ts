import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Effect as E, pipe } from "effect";
import type { CollectionNotFoundError, DatabaseError } from "#/common/errors";
import type { AppBindings } from "#/env";
import * as SystemRepository from "./system.repository";
import type {
  AboutNode,
  BuildInfo,
  MaintenanceInfo,
  SetLogLevelCommand,
  StartMaintenanceCommand,
  StopMaintenanceCommand,
} from "./system.types";

const started = new Date();
let buildInfo: BuildInfo;

export function getNodeInfo(
  ctx: AppBindings,
): E.Effect<AboutNode, CollectionNotFoundError | DatabaseError> {
  const { node } = ctx;

  return pipe(
    getMaintenanceStatus(ctx),
    E.map((maintenance) => ({
      started,
      build: getBuildInfo(ctx),
      publicKey: node.keypair.publicKey("hex"),
      url: node.endpoint,
      maintenance,
    })),
  );
}

function getBuildInfo(ctx: AppBindings): BuildInfo {
  if (buildInfo) {
    return buildInfo;
  }

  try {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const buildInfoPath = path.join(__dirname, "../../buildinfo.json");
    const content = fs.readFileSync(buildInfoPath, "utf-8");
    return JSON.parse(content) as BuildInfo;
  } catch (_error) {
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
 * Sets the node's log level based on the provided command.
 *
 * @param ctx - Application context and bindings
 * @param command - Set log level command with new level
 * @returns Effect that succeeds when log level is set
 */
export function setLogLevel(
  ctx: AppBindings,
  command: SetLogLevelCommand,
): E.Effect<void, never> {
  return E.sync(() => {
    ctx.log.level = command.level;
    ctx.log.info(`Log level set to: ${command.level}`);
  });
}

/**
 * Starts maintenance mode based on the provided command.
 *
 * @param ctx - Application context and bindings
 * @param _command - Start maintenance command (no parameters needed, unused but required for consistency)
 * @returns Effect that succeeds when maintenance mode is started
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
 * Stops maintenance mode based on the provided command.
 *
 * @param ctx - Application context and bindings
 * @param _command - Stop maintenance command (no parameters needed, unused but required for consistency)
 * @returns Effect that succeeds when maintenance mode is stopped
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

export function getMaintenanceStatus(
  ctx: AppBindings,
): E.Effect<MaintenanceInfo, CollectionNotFoundError | DatabaseError> {
  return pipe(
    SystemRepository.findMaintenanceConfig(ctx),
    E.map((document) =>
      document
        ? { active: true, startedAt: document.startedAt }
        : { active: false, startedAt: new Date(0) },
    ),
  );
}
