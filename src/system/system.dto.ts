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
  .meta({ ref: "SetLogLevelRequest" });

export type SetLogLevelRequest = z.infer<typeof SetLogLevelRequest>;

/**
 * Log level update response.
 */
export const SetLogLevelResponse = z.string();
export type SetLogLevelResponse = z.infer<typeof SetLogLevelResponse>;

/**
 * Health check response type.
 */
export type HealthCheckResponse = typeof Response;

/**
 * Start maintenance response.
 */
export const StartMaintenanceResponse = z.string();
export type StartMaintenanceResponse = z.infer<typeof StartMaintenanceResponse>;

/**
 * Stop maintenance response.
 */
export const StopMaintenanceResponse = z.string();
export type StopMaintenanceResponse = z.infer<typeof StopMaintenanceResponse>;

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
  .meta({ ref: "ReadAboutNodeResponse" });

export type ReadAboutNodeResponse = z.infer<typeof ReadAboutNodeResponse>;

/**
 * Log level retrieval response.
 */
export const ReadLogLevelResponse = ApiSuccessResponse(LogLevel).meta({
  ref: "ReadLogLevelResponse",
});

export type ReadLogLevelResponse = z.infer<typeof ReadLogLevelResponse>;
