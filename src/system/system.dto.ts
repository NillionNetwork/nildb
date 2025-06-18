import { StatusCodes } from "http-status-codes";
import { z } from "zod";
import { ApiSuccessResponse } from "#/common/handler";
import { LogLevel } from "#/common/logger";

/**
 * Log level update request.
 */
export const SetLogLevelRequest = z
  .object({
    level: LogLevel,
  })
  .openapi({ ref: "SetLogLevelRequest" });

export type SetLogLevelRequest = z.infer<typeof SetLogLevelRequest>;

/**
 * Log level update response.
 */
export const SetLogLevelResponse = new Response(null, {
  status: StatusCodes.OK,
});

/**
 * Log level update response type.
 */
export type SetLogLevelResponse = typeof SetLogLevelResponse;

/**
 * Health check response type.
 */
export type HealthCheckResponse = typeof Response;

/**
 * Start maintenance response.
 */
export const StartMaintenanceResponse = new Response(null, {
  status: StatusCodes.OK,
});

/**
 * Start maintenance response type.
 */
export type StartMaintenanceResponse = typeof StartMaintenanceResponse;

/**
 * Stop maintenance response.
 */
export const StopMaintenanceResponse = new Response(null, {
  status: StatusCodes.OK,
});

/**
 * Stop maintenance response type.
 */
export type StopMaintenanceResponse = typeof StopMaintenanceResponse;

/**
 * Node information response.
 */
export const ReadAboutNodeResponse = z
  .object({
    started: z.string().datetime(),
    build: z.object({
      time: z.string().datetime(),
      commit: z.string(),
      version: z.string(),
    }),
    public_key: z.string(),
    url: z.string().url(),
    maintenance: z.object({
      active: z.boolean(),
      started_at: z.string().datetime(),
    }),
  })
  .openapi({ ref: "ReadAboutNodeResponse" });

export type ReadAboutNodeResponse = z.infer<typeof ReadAboutNodeResponse>;

/**
 * Log level retrieval response.
 */
export const ReadLogLevelResponse = ApiSuccessResponse(LogLevel).openapi({
  ref: "ReadLogLevelResponse",
});

export type ReadLogLevelResponse = z.infer<typeof ReadLogLevelResponse>;
