import type { LogLevel } from "@nildb/common/logger";
import type {
  ReadAboutNodeResponse,
  ReadLogLevelResponse,
  SetLogLevelRequest,
} from "./system.dto.js";
import type {
  AboutNode,
  SetLogLevelCommand,
  StartMaintenanceCommand,
  StopMaintenanceCommand,
} from "./system.types.js";

/**
 * System data mapper.
 */
export const SystemDataMapper = {
  /**
   * Convert log level request to command.
   */
  toSetLogLevelCommand(dto: SetLogLevelRequest): SetLogLevelCommand {
    return {
      level: dto.level,
    };
  },

  /**
   * Create start maintenance command.
   */
  toStartMaintenanceCommand(): StartMaintenanceCommand {
    return {};
  },

  /**
   * Create stop maintenance command.
   */
  toStopMaintenanceCommand(): StopMaintenanceCommand {
    return {};
  },

  /**
   * Convert node info to about response.
   */
  toGetAboutNodeResponse(about: AboutNode): ReadAboutNodeResponse {
    return {
      started: about.started.toISOString(),
      build: about.build,
      public_key: about.publicKey,
      url: about.url,
      maintenance: {
        active: about.maintenance.active,
        started_at: about.maintenance.startedAt.toISOString(),
      },
    };
  },

  /**
   * Convert log level to response.
   */
  toGetLogLevelResponse(level: LogLevel): ReadLogLevelResponse {
    return { data: level };
  },
};
