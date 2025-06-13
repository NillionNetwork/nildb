import type { Did } from "#/common/types";
import type {
  ReadProfileResponse,
  RegisterBuilderRequest,
  UpdateProfileRequest,
} from "./builders.dto";
import type {
  BuilderDocument,
  CreateBuilderCommand,
  UpdateProfileCommand,
} from "./builders.types";

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
        _id: data._id,
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
  toCreateBuilderCommand(dto: RegisterBuilderRequest): CreateBuilderCommand {
    return {
      did: dto.did,
      name: dto.name,
    };
  },

  /**
   * Convert update request to update command.
   */
  toUpdateProfileCommand(
    dto: UpdateProfileRequest,
    builder: Did,
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
