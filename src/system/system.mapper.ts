import type { LogLevel } from "#/common/logger";
import type {
  GetAboutNodeResponse,
  GetLogLevelResponse,
  SetLogLevelRequest,
} from "./system.dto";
import type {
  AboutNode,
  SetLogLevelCommand,
  StartMaintenanceCommand,
  StopMaintenanceCommand,
} from "./system.types";

/**
 * Transforms data between HTTP DTOs and domain models for system operations.
 *
 * Centralizes all data transformations to maintain clean layer boundaries.
 * Higher layers (controllers) use these functions to convert DTOs to domain
 * models and vice versa for system configuration and node management.
 */
export const SystemDataMapper = {
  /**
   * Converts set log level request DTO to domain command.
   *
   * Handles DTO to domain command conversion at the boundary layer.
   *
   * @param dto - Set log level request DTO
   * @returns Set log level domain command
   */
  toSetLogLevelCommand(dto: SetLogLevelRequest): SetLogLevelCommand {
    return {
      level: dto.level,
    };
  },

  /**
   * Creates start maintenance command.
   *
   * No DTO conversion needed as this operation has no parameters.
   *
   * @returns Start maintenance domain command
   */
  toStartMaintenanceCommand(): StartMaintenanceCommand {
    return {};
  },

  /**
   * Creates stop maintenance command.
   *
   * No DTO conversion needed as this operation has no parameters.
   *
   * @returns Stop maintenance domain command
   */
  toStopMaintenanceCommand(): StopMaintenanceCommand {
    return {};
  },

  /**
   * Converts node information to response DTO.
   *
   * Transforms domain model to API response format, converting dates
   * to ISO strings and mapping field names from camelCase to snake_case
   * for API consistency.
   *
   * @param about - Node information domain model
   * @returns About node response DTO with serialized dates
   */
  toGetAboutNodeResponse(about: AboutNode): GetAboutNodeResponse {
    return {
      started: about.started.toISOString(),
      build: about.build,
      did: about.did,
      public_key: about.publicKey,
      url: about.url,
      maintenance: {
        active: about.maintenance.active,
        started_at: about.maintenance.startedAt.toISOString(),
      },
    };
  },

  /**
   * Wraps log level in success response format.
   *
   * Converts a simple log level value into the standardized
   * API success response structure.
   *
   * @param level - Current log level value
   * @returns Formatted log level response DTO
   */
  toGetLogLevelResponse(level: LogLevel): GetLogLevelResponse {
    return { data: level };
  },
};
