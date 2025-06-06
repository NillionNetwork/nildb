import { StatusCodes } from "http-status-codes";
import { z } from "zod";
import { ApiSuccessResponse } from "#/common/handler";
import { LogLevel } from "#/common/logger";
import { DidSchema } from "#/common/types";

/**
 * Request schema for updating the node's log level.
 *
 * @example
 * {
 *   "level": "debug"
 * }
 */
export const SetLogLevelRequest = z
  .object({
    level: LogLevel,
  })
  .openapi({ ref: "SetLogLevelRequest" });

export type SetLogLevelRequest = z.infer<typeof SetLogLevelRequest>;

/**
 * Response for successful log level update.
 *
 * Returns HTTP 200 OK with empty body to indicate
 * the log level was updated successfully.
 */
export const SetLogLevelResponse = new Response(null, {
  status: StatusCodes.OK,
});

/**
 * Response for health check endpoint.
 *
 * Returns HTTP 200 OK with empty body to indicate
 * the node is healthy and operational.
 */
export const HealthCheckResponse = new Response(null, {
  status: StatusCodes.OK,
});

/**
 * Response for starting maintenance mode.
 *
 * Returns HTTP 200 OK with empty body to indicate
 * maintenance mode was activated successfully.
 */
export const StartMaintenanceResponse = new Response(null, {
  status: StatusCodes.OK,
});

/**
 * Response for stopping maintenance mode.
 *
 * Returns HTTP 200 OK with empty body to indicate
 * maintenance mode was deactivated successfully.
 */
export const StopMaintenanceResponse = new Response(null, {
  status: StatusCodes.OK,
});

/**
 * Response schema for node information and status.
 *
 * Provides comprehensive information about the node including
 * build details, identity, and operational status.
 *
 * @example
 * {
 *   "started": "2023-12-01T10:00:00.000Z",
 *   "build": {
 *     "time": "2023-11-30T09:00:00.000Z",
 *     "commit": "abc123def456",
 *     "version": "1.0.0"
 *   },
 *   "public_key": "030923f2e7120c50e42905b857ddd2947f6ecced6bb02aab64e63b28e9e2e06d10",
 *   "did": "did:nil:030923f2e7120c50e42905b857ddd2947f6ecced6bb02aab64e63b28e9e2e06d10",
 *   "url": "https://api.nillion.com",
 *   "maintenance": {
 *     "active": false,
 *     "started_at": "2023-12-01T08:00:00.000Z"
 *   }
 * }
 */
export const GetAboutNodeResponse = z
  .object({
    started: z.string().datetime(),
    build: z.object({
      time: z.string().datetime(),
      commit: z.string(),
      version: z.string(),
    }),
    public_key: z.string(),
    did: DidSchema,
    url: z.string().url(),
    maintenance: z.object({
      active: z.boolean(),
      started_at: z.string().datetime(),
    }),
  })
  .openapi({ ref: "GetAboutNodeResponse" });

export type GetAboutNodeResponse = z.infer<typeof GetAboutNodeResponse>;

/**
 * Response schema for current log level retrieval.
 *
 * @example
 * {
 *   "data": "info"
 * }
 */
export const GetLogLevelResponse = ApiSuccessResponse(LogLevel).openapi({
  ref: "GetLogLevelResponse",
});

export type GetLogLevelResponse = z.infer<typeof GetLogLevelResponse>;
