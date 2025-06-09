import type { DeleteResult, UpdateResult } from "mongodb";
import { UUID } from "mongodb";
import type {
  DeleteDataRequest,
  DeleteDataResponse,
  FlushDataRequest,
  FlushDataResponse,
  ReadDataRequest,
  ReadDataResponse,
  TailDataRequest,
  TailDataResponse,
  UpdateDataRequest,
  UpdateDataResponse,
  UploadDataResponse,
  UploadOwnedDataRequest,
  UploadStandardDataRequest,
} from "./data.dto";
import type { DataDocument, UploadResult } from "./data.repository";
import type {
  CreateOwnedRecordsCommand,
  CreateStandardRecordsCommand,
  DeleteRecordsCommand,
  FlushCollectionCommand,
  ReadRecordsCommand,
  TailDataCommand,
  UpdateRecordsCommand,
} from "./data.types";

/**
 * Transforms data between HTTP DTOs and domain models.
 *
 * Centralizes all data transformations to maintain clean layer boundaries.
 * Higher layers (controllers) use these functions to convert domain
 * models to DTOs for API responses.
 */
export const DataMapper = {
  /**
   * Converts an upload result to response DTO.
   *
   * @param result - Upload result from repository
   * @returns Upload response DTO
   */
  toUploadDataResponse(result: UploadResult): UploadDataResponse {
    return {
      data: {
        created: result.created,
        errors: result.errors,
      },
    };
  },

  /**
   * Converts MongoDB update result to response DTO.
   *
   * @param result - MongoDB update result
   * @returns Update response DTO
   */
  toUpdateDataResponse(result: UpdateResult): UpdateDataResponse {
    return {
      data: {
        acknowledged: result.acknowledged,
        matchedCount: result.matchedCount,
        modifiedCount: result.modifiedCount,
        upsertedCount: result.upsertedCount,
        upsertedId: result.upsertedId?.toString() ?? null,
      },
    };
  },

  /**
   * Converts array of data documents to read response DTO.
   * Serializes dates to ISO strings for JSON compatibility.
   *
   * @param documents - Array of data documents
   * @returns Read response DTO
   */
  toReadDataResponse(documents: DataDocument[]): ReadDataResponse {
    return {
      data: documents.map((doc) => ({
        ...doc,
        _id: doc._id.toString(),
        _created: doc._created.toISOString(),
        _updated: doc._updated.toISOString(),
        _owner: doc._owner,
      })),
    };
  },

  /**
   * Converts MongoDB delete result to response DTO.
   *
   * @param result - MongoDB delete result
   * @returns Delete response DTO
   */
  toDeleteDataResponse(result: DeleteResult): DeleteDataResponse {
    return {
      data: {
        acknowledged: result.acknowledged,
        deletedCount: result.deletedCount,
      },
    };
  },

  /**
   * Converts MongoDB delete result to flush response DTO.
   *
   * @param result - MongoDB delete result
   * @returns Flush response DTO
   */
  toFlushDataResponse(result: DeleteResult): FlushDataResponse {
    return {
      data: {
        acknowledged: result.acknowledged,
        deletedCount: result.deletedCount,
      },
    };
  },

  /**
   * Converts array of data documents to tail response DTO.
   * Serializes dates to ISO strings for JSON compatibility.
   *
   * @param documents - Array of data documents
   * @returns Tail response DTO
   */
  toTailDataResponse(documents: DataDocument[]): TailDataResponse {
    return {
      data: documents.map((doc) => ({
        ...doc,
        _id: doc._id.toString(),
        _created: doc._created.toISOString(),
        _updated: doc._updated.toISOString(),
        _owner: doc._owner,
      })),
    };
  },

  /**
   * Converts upload owned data request DTO to domain command.
   *
   * Handles DTO to domain command conversion at the boundary layer.
   *
   * @param dto - Upload data request DTO
   * @returns Create records domain command
   */
  toCreateOwnedRecordsCommand(
    dto: UploadOwnedDataRequest,
  ): CreateOwnedRecordsCommand {
    return {
      owner: dto.userId,
      schemaId: new UUID(dto.schema),
      data: dto.data,
      permissions: dto.permissions,
    };
  },

  /**
   * Converts upload standard data request DTO to domain command.
   *
   * Handles DTO to domain command conversion at the boundary layer.
   *
   * @param dto - Upload data request DTO
   * @returns Create records domain command
   */
  toCreateStandardRecordsCommand(
    dto: UploadStandardDataRequest,
  ): CreateStandardRecordsCommand {
    return {
      schemaId: new UUID(dto.schema),
      data: dto.data,
    };
  },

  /**
   * Converts update data request DTO to domain command.
   *
   * Handles string to UUID conversion at the boundary layer.
   *
   * @param dto - Update data request DTO
   * @returns Update records domain command
   */
  toUpdateRecordsCommand(dto: UpdateDataRequest): UpdateRecordsCommand {
    return {
      schema: new UUID(dto.schema),
      filter: dto.filter,
      update: dto.update,
    };
  },

  /**
   * Converts read data request DTO to domain command.
   *
   * Handles string to UUID conversion at the boundary layer.
   *
   * @param dto - Read data request DTO
   * @returns Read records domain command
   */
  toReadRecordsCommand(dto: ReadDataRequest): ReadRecordsCommand {
    return {
      schema: new UUID(dto.schema),
      filter: dto.filter,
    };
  },

  /**
   * Converts delete data request DTO to domain command.
   *
   * Handles string to UUID conversion at the boundary layer.
   *
   * @param dto - Delete data request DTO
   * @returns Delete records domain command
   */
  toDeleteRecordsCommand(dto: DeleteDataRequest): DeleteRecordsCommand {
    return {
      schema: new UUID(dto.schema),
      filter: dto.filter,
    };
  },

  /**
   * Converts flush data request DTO to domain command.
   *
   * Handles string to UUID conversion at the boundary layer.
   *
   * @param dto - Flush data request DTO
   * @returns Flush collection domain command
   */
  toFlushCollectionCommand(dto: FlushDataRequest): FlushCollectionCommand {
    return {
      schema: new UUID(dto.schema),
    };
  },

  /**
   * Converts tail data request DTO to domain command.
   *
   * Handles string to UUID conversion at the boundary layer.
   *
   * @param dto - Tail data request DTO
   * @returns Tail data domain command
   */
  toTailDataCommand(dto: TailDataRequest): TailDataCommand {
    return {
      schema: new UUID(dto.schema),
    };
  },
};
