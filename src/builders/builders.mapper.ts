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
 * Transforms data between HTTP DTOs and domain models.
 */
export const BuilderDataMapper = {
  /**
   * Converts a domain builder document to an api response dto.
   */
  toReadProfileResponse(data: BuilderDocument): ReadProfileResponse {
    return {
      data: {
        _id: data._id,
        _created: data._created.toISOString(),
        _updated: data._updated.toISOString(),
        name: data.name,
        schemas: data.schemas.map((s) => s.toString()),
        queries: data.queries.map((q) => q.toString()),
      },
    };
  },

  /**
   * Converts registration request dto to domain command.
   */
  toCreateBuilderCommand(dto: RegisterBuilderRequest): CreateBuilderCommand {
    return {
      did: dto.did,
      name: dto.name,
    };
  },

  /**
   * Converts update profile request dto to domain command.
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
