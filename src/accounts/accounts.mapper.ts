import type { Did } from "#/common/types";
import type {
  GetProfileResponse,
  RegisterAccountRequest,
  UpdateProfileRequest,
} from "./accounts.dto";
import type {
  CreateAccountCommand,
  OrganizationAccountDocument,
  UpdateProfileCommand,
} from "./accounts.types";

/**
 * Transforms data between HTTP DTOs and domain models.
 *
 * Centralises all data transformations to maintain clean layer boundaries.
 * Higher layers (controllers) use these functions to convert DTOs to domain
 * models before passing them to lower layers (services).
 */
export const AccountDataMapper = {
  /**
   * Converts a domain account document to an API response DTO.
   *
   * Transforms dates to ISO strings and UUIDs to strings for
   * JSON serialisation compatibility.
   *
   * @param data - Organisation account document from domain layer
   * @returns Profile response DTO for HTTP layer
   */
  toGetProfileResponse(data: OrganizationAccountDocument): GetProfileResponse {
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
   * Converts registration request DTO to domain command.
   *
   * Handles DTO to domain command conversion at the boundary layer.
   *
   * @param dto - Registration request DTO
   * @returns Create account domain command
   */
  toCreateAccountCommand(dto: RegisterAccountRequest): CreateAccountCommand {
    return {
      did: dto.did,
      name: dto.name,
    };
  },

  /**
   * Converts update profile request DTO to domain command.
   *
   * Handles DTO to domain command conversion with account ID at the boundary layer.
   *
   * @param dto - Update profile request DTO
   * @param accountId - Account identifier to update
   * @returns Update profile domain command
   */
  toUpdateProfileCommand(
    dto: UpdateProfileRequest,
    accountId: Did,
  ): UpdateProfileCommand {
    return {
      accountId,
      updates: {
        ...(dto.name !== undefined && { name: dto.name }),
      },
    };
  },
};
