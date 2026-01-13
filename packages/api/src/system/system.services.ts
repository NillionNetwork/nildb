import { BUILD_COMMIT, BUILD_TIME, BUILD_VERSION } from "@nildb/common/buildinfo";
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

/**
 * Get node information.
 */
export function getNodeInfo(ctx: AppBindings): E.Effect<AboutNode, CollectionNotFoundError | DatabaseError> {
  const { node } = ctx;

  return pipe(
    getMaintenanceStatus(ctx),
    E.map((maintenance) => ({
      started,
      build: getBuildInfo(),
      publicKey: node.publicKey,
      url: node.endpoint,
      maintenance,
    })),
  );
}

/**
 * Get build information.
 */
function getBuildInfo(): BuildInfo {
  return {
    time: BUILD_TIME,
    commit: BUILD_COMMIT,
    version: BUILD_VERSION,
  };
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
