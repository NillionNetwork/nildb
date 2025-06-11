import { type UpdateResult, UUID } from "mongodb";
import type { Did } from "#/common/types";
import type { DataDocument } from "#/data/data.repository";
import type {
  AddPermissionsRequest,
  AddPermissionsResponse,
  DeletePermissionsRequest,
  DeletePermissionsResponse,
  GrantedAccess,
  ListUserDataResponse,
  ReadPermissionsRequest,
  ReadPermissionsResponse,
  UpdatePermissionsRequest,
  UpdatePermissionsResponse,
} from "./user.dto";
import type {
  AddPermissionsCommand,
  DeletePermissionsCommand,
  LogOperation,
  ReadPermissionsCommand,
  UpdatePermissionsCommand,
} from "./user.types";

/**
 * Transforms data between HTTP DTOs and domain models for user operations.
 *
 * Centralizes all data transformations to maintain clean layer boundaries.
 * Higher layers (controllers) use these functions to convert domain
 * models to DTOs for API responses.
 */
export const UserDataMapper = {
  /**
   * Converts MongoDB update result to add permissions response DTO.
   *
   * @param result - MongoDB update result
   * @returns Add permissions response DTO
   */
  toAddPermissionsResponse(result: UpdateResult): AddPermissionsResponse {
    return {
      data: {
        upserted_id: result.upsertedId ? result.upsertedId.toString() : null,
        acknowledged: result.acknowledged,
        matched_count: result.matchedCount,
        modified_count: result.modifiedCount,
        upserted_count: result.upsertedCount,
      },
    };
  },

  /**
   * Converts MongoDB update result to update permissions response DTO.
   *
   * @param result - MongoDB update result
   * @returns Update permissions response DTO
   */
  toUpdatePermissionsResponse(result: UpdateResult): UpdatePermissionsResponse {
    return {
      data: {
        upserted_id: result.upsertedId ? result.upsertedId.toString() : null,
        acknowledged: result.acknowledged,
        matched_count: result.matchedCount,
        modified_count: result.modifiedCount,
        upserted_count: result.upsertedCount,
      },
    };
  },

  /**
   * Converts MongoDB update result to delete permissions response DTO.
   *
   * @param result - MongoDB update result
   * @returns Delete permissions response DTO
   */
  toDeletePermissionsResponse(result: UpdateResult): DeletePermissionsResponse {
    return {
      data: {
        upserted_id: result.upsertedId ? result.upsertedId.toString() : null,
        acknowledged: result.acknowledged,
        matched_count: result.matchedCount,
        modified_count: result.modifiedCount,
        upserted_count: result.upsertedCount,
      },
    };
  },

  /**
   * Converts array of data documents to list user data response DTO.
   *
   * Serializes dates to ISO strings and ensures all fields are properly
   * formatted for API consumption.
   *
   * @param documents - Array of data documents owned by the user
   * @returns List user data response DTO
   */
  toListUserDataResponse(documents: DataDocument[]): ListUserDataResponse {
    return {
      data: documents.map((doc) => ({
        _id: doc._id.toString(),
        _created: doc._created.toISOString(),
        _updated: doc._updated.toISOString(),
        _owner: doc._owner,
        // Include any additional fields from the document
        ...Object.fromEntries(
          Object.entries(doc).filter(
            ([key]) =>
              ![
                "_id",
                "_created",
                "_updated",
                "_owner",
                "_tokens",
                "_grantedAccess",
              ].includes(key),
          ),
        ),
      })),
    };
  },

  /**
   * Converts array of permissions to read permissions response DTO.
   *
   * @param grantedAccess - Array of permission objects
   * @returns Read permissions response DTO
   */
  toReadPermissionsResponse(
    grantedAccess: GrantedAccess[],
  ): ReadPermissionsResponse {
    return {
      data: grantedAccess,
    };
  },

  /**
   * Converts read permissions request DTO to domain command.
   *
   * Handles string to UUID conversion at the boundary layer.
   *
   * @param dto - Read permissions request DTO
   * @returns Read permissions domain command
   */
  toReadPermissionsCommand(
    dto: ReadPermissionsRequest,
  ): ReadPermissionsCommand {
    return {
      schema: new UUID(dto.schema),
      documentId: new UUID(dto.documentId),
    };
  },

  /**
   * Converts add permissions request DTO to domain command.
   *
   * Handles string to UUID conversion and permission DTO mapping at the boundary layer.
   *
   * @param dto - Add permissions request DTO
   * @returns Add permissions domain command
   */
  toAddPermissionsCommand(dto: AddPermissionsRequest): AddPermissionsCommand {
    return {
      schema: new UUID(dto.schema),
      documentId: new UUID(dto.documentId),
      grantAccess: dto.grantAccess,
    };
  },

  /**
   * Converts update permissions request DTO to domain command.
   *
   * Handles string to UUID conversion and permission DTO mapping at the boundary layer.
   *
   * @param dto - Update permissions request DTO
   * @returns Update permissions domain command
   */
  toUpdatePermissionsCommand(
    dto: UpdatePermissionsRequest,
  ): UpdatePermissionsCommand {
    return {
      schema: new UUID(dto.schema),
      documentId: new UUID(dto.documentId),
      grantAccess: dto.grantAccess,
    };
  },

  /**
   * Converts delete permissions request DTO to domain command.
   *
   * Handles string to UUID conversion at the boundary layer.
   *
   * @param dto - Delete permissions request DTO
   * @returns Delete permissions domain command
   */
  toDeletePermissionsCommand(
    dto: DeletePermissionsRequest,
  ): DeletePermissionsCommand {
    return {
      schema: new UUID(dto.schema),
      documentId: new UUID(dto.documentId),
      did: dto.did,
    };
  },
} as const;

/**
 * Transforms data between HTTP DTOs and domain models for user log operations.
 *
 * Centralizes all data transformations to maintain clean layer boundaries.
 */
export const LoggerOperationMapper = {
  toMultipleCreateDataLogOperation(documents: UUID[]): LogOperation[] {
    return documents.map(this.toCreateDataLogOperation);
  },

  toCreateDataLogOperation(document: UUID): LogOperation {
    return { op: "create-data", document };
  },

  toMultipleDeleteDataLogOperation(documents: UUID[]): LogOperation[] {
    return documents.map(this.toDeleteDataLogOperation);
  },

  toDeleteDataLogOperation(document: UUID): LogOperation {
    return { op: "delete-data", document };
  },

  toMultipleGrantAccessLogOperation(
    documents: UUID[],
    grantAccess?: GrantedAccess,
  ): LogOperation[] {
    if (!grantAccess) {
      return [];
    }
    return documents.map((d) => this.toGrantAccessLogOperation(d, grantAccess));
  },

  toGrantAccessLogOperation(
    document: UUID,
    grantAccess: GrantedAccess,
  ): LogOperation {
    return {
      op: "grant-access",
      document,
      did: grantAccess.did,
      perms: grantAccess.perms,
    };
  },

  toUpdateAccessLogOperation(
    document: UUID,
    grantAccess: GrantedAccess,
  ): LogOperation {
    return {
      op: "update-access",
      document,
      did: grantAccess.did,
      perms: grantAccess.perms,
    };
  },

  toRevokeAccessLogOperation(document: UUID, did: Did): LogOperation {
    return {
      op: "revoke-access",
      document,
      did,
    };
  },
} as const;
