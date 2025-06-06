import { Effect as E, pipe } from "effect";
import type { Context, MiddlewareHandler, Next } from "hono";
import { StatusCodes } from "http-status-codes";
import { Temporal } from "temporal-polyfill";
import { type ApiErrorResponse, handleTaggedErrors } from "#/common/handler";
import { PathsV1 } from "#/common/paths";
import type { AppBindings, AppEnv } from "#/env";
import * as SystemService from "#/system/system.services";

const MAINTENANCE_EXCLUDED_PATHS: string[] = [
  PathsV1.system.maintenanceStart,
  PathsV1.system.maintenanceStop,
  PathsV1.system.health,
  PathsV1.system.about,
  PathsV1.system.metrics,
  PathsV1.docs,
];

export function useMaintenanceMiddleware(ctx: AppBindings): MiddlewareHandler {
  return async (c: Context<AppEnv>, next: Next) => {
    const isPathExcludedFromMaintenance = MAINTENANCE_EXCLUDED_PATHS.some(
      (path) => c.req.path.startsWith(path),
    );

    if (isPathExcludedFromMaintenance) {
      return next();
    }

    return pipe(
      SystemService.getMaintenanceStatus(ctx),
      // @ts-expect-error if maintenance is active then we manually short circuit the request
      // and disable typescript's complaint about the return value being `Response | Promise<void>`
      E.map((maintenance) => {
        if (maintenance.active) {
          const payload: ApiErrorResponse = {
            ts: Temporal.Now.instant().toString(),
            errors: ["Node is in maintenance"],
          };
          return c.json(payload, StatusCodes.SERVICE_UNAVAILABLE);
        }
        return next();
      }),
      handleTaggedErrors(c),
      E.runPromise,
    );
  };
}
