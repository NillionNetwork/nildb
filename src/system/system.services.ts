import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Effect as E, Option as O, pipe } from "effect";
import { Temporal } from "temporal-polyfill";
import type { AdminSetMaintenanceWindowRequest } from "#/admin/admin.types";
import {
  DataValidationError,
  type DatabaseError,
  type DocumentNotFoundError,
  type PrimaryCollectionNotFoundError,
} from "#/common/errors";
import type { Did } from "#/common/types";
import type { AppBindings } from "#/env";
import * as SystemRepository from "./system.repository";
import type { MaintenanceWindow } from "./system.types";

export type AboutNode = {
  started: Date;
  build: BuildInfo;
  did: Did;
  publicKey: string;
  url: string;
  maintenance?: MaintenanceWindow;
};

type BuildInfo = {
  time: string;
  commit: string;
  version: string;
};

const started = new Date();
let buildInfo: BuildInfo;

export function getNodeInfo(
  bindings: AppBindings,
): E.Effect<AboutNode, PrimaryCollectionNotFoundError | DatabaseError> {
  const nodeInfo: AboutNode = {
    started,
    build: getBuildInfo(bindings),
    did: bindings.node.keypair.toDidString(),
    publicKey: bindings.node.keypair.publicKey("hex"),
    url: bindings.node.endpoint,
  };

  return pipe(
    getMaintenanceStatus(bindings),
    E.flatMap((maintenanceStatus) => {
      if (maintenanceStatus.active && maintenanceStatus.window) {
        nodeInfo.maintenance = maintenanceStatus.window;
      }
      return E.succeed(nodeInfo);
    }),
  );
}

function getBuildInfo(bindings: AppBindings): BuildInfo {
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
    bindings.log.info("No buildinfo.json found using fallback values");
    buildInfo = {
      time: "1970-01-01T00:00:00Z",
      commit: "unknown",
      version: "0.0.0",
    };
    return buildInfo;
  }
}

export function setMaintenanceWindow(
  ctx: AppBindings,
  request: AdminSetMaintenanceWindowRequest,
): E.Effect<
  void,
  DataValidationError | PrimaryCollectionNotFoundError | DatabaseError
> {
  return pipe(
    E.succeed(request),
    E.flatMap((request) => {
      const now = Temporal.Now.instant().epochMilliseconds;
      const start = Temporal.Instant.from(
        request.start.toISOString(),
      ).epochMilliseconds;
      const end = Temporal.Instant.from(
        request.end.toISOString(),
      ).epochMilliseconds;

      if (end < now || end <= start) {
        return E.fail(
          new DataValidationError({
            issues: ["End date must be in the future and after the start date"],
            cause: request,
          }),
        );
      }

      return E.succeed(request);
    }),
    E.flatMap((request) => SystemRepository.setMaintenanceWindow(ctx, request)),
    E.tap(() =>
      ctx.log.debug(
        `Set maintenance window.start=${request.start.toISOString()} and window.end=${request.end.toISOString()}`,
      ),
    ),
  );
}

type MaintenanceStatus = {
  active: boolean;
  window: MaintenanceWindow | null;
};

export function getMaintenanceStatus(
  ctx: AppBindings,
): E.Effect<MaintenanceStatus, PrimaryCollectionNotFoundError | DatabaseError> {
  return pipe(
    SystemRepository.findMaintenanceWindow(ctx),
    E.catchTag("DocumentNotFoundError", () => E.succeed(O.none())),
    E.flatMap((window) => {
      const maintenanceStatus: MaintenanceStatus = {
        active: false,
        window: null,
      };

      if (O.isNone(window)) {
        return E.succeed(maintenanceStatus);
      }

      const now = Temporal.Now.instant().epochMilliseconds;
      const start = window.value.start.epochMilliseconds;
      const end = window.value.end.epochMilliseconds;

      maintenanceStatus.active = now >= start && now <= end;
      maintenanceStatus.window = window.value;
      return E.succeed(maintenanceStatus);
    }),
  );
}

export function deleteMaintenanceWindow(
  ctx: AppBindings,
): E.Effect<
  void,
  | DocumentNotFoundError
  | DataValidationError
  | PrimaryCollectionNotFoundError
  | DatabaseError
> {
  return pipe(
    SystemRepository.deleteMaintenanceWindow(ctx),
    E.as(void 0),
    E.tap(() => ctx.log.debug("Deleted maintenance window")),
  );
}
