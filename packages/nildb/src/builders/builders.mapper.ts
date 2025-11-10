import { normalizeIdentifier } from "@nildb/common/did-utils";
import type {
  ReadProfileResponse,
  RegisterBuilderRequest,
  UpdateProfileRequest,
} from "@nillion/nildb-types";
import type { Logger } from "pino";
import type {
  BuilderDocument,
  CreateBuilderCommand,
  UpdateProfileCommand,
} from "./builders.types.js";

/**
 * Builder data mapper.
 */
export const BuilderDataMapper = {
  /**
   * Convert builder document to profile response.
   */
  toReadProfileResponse(data: BuilderDocument): ReadProfileResponse {
    return {
      data: {
        _id: data.did,
        _created: data._created.toISOString(),
        _updated: data._updated.toISOString(),
        name: data.name,
        collections: data.collections.map((s) => s.toString()),
        queries: data.queries.map((q) => q.toString()),
      },
    };
  },

  /**
   * Convert registration request to create command.
   */
  toCreateBuilderCommand(
    dto: RegisterBuilderRequest,
    log: Logger,
  ): CreateBuilderCommand {
    return {
      did: normalizeIdentifier(dto.did, log),
      name: dto.name,
    };
  },

  /**
   * Convert update request to update command.
   */
  toUpdateProfileCommand(
    dto: UpdateProfileRequest,
    builder: string,
  ): UpdateProfileCommand {
    return {
      builder,
      updates: {
        _updated: new Date(),
        name: dto.name,
      },
    };
  },
};
