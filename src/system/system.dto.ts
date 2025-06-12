import { StatusCodes } from "http-status-codes";
import { z } from "zod";
import { ApiSuccessResponse } from "#/common/handler";
import { LogLevel } from "#/common/logger";

/**
 * Request schema for updating the node's log level.
 */
export const SetLogLevelRequest = z
  .object({
    level: LogLevel,
  })
  .openapi({ ref: "SetLogLevelRequest" });

export type SetLogLevelRequest = z.infer<typeof SetLogLevelRequest>;

/**
 * Response for successful log level update.
 */
export const SetLogLevelResponse = new Response(null, {
  status: StatusCodes.OK,
});

/**
 * Response for health check endpoint.
 */
export const HealthCheckResponse = new Response(null, {
  status: StatusCodes.OK,
});

/**
 * Response for starting maintenance mode.
 */
export const StartMaintenanceResponse = new Response(null, {
  status: StatusCodes.OK,
});

/**
 * Response for stopping maintenance mode.
 */
export const StopMaintenanceResponse = new Response(null, {
  status: StatusCodes.OK,
});

/**
 * Response schema for node information.
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
 * Response schema for current log level retrieval.
 */
export const ReadLogLevelResponse = ApiSuccessResponse(LogLevel).openapi({
  ref: "ReadLogLevelResponse",
});

export type ReadLogLevelResponse = z.infer<typeof ReadLogLevelResponse>;
