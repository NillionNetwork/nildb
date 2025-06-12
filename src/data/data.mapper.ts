import type { DeleteResult, UpdateResult } from "mongodb";
import { UUID } from "mongodb";
import type { DocumentBase } from "#/common/mongo";
import type {
  CreateDataResponse,
  CreateOwnedDataRequest,
  CreateStandardDataRequest,
  DataSchemaByIdRequestParams,
  DeleteDataRequest,
  DeleteDataResponse,
  DropDataResponse,
  FindDataRequest,
  FindDataResponse,
  FlushDataRequest,
  TailDataRequestParams,
  TailDataRequestQuery,
  TailDataResponse,
  UpdateDataRequest,
  UpdateDataResponse,
} from "./data.dto";
import type {
  CreateOwnedDataCommand,
  CreateStandardDataCommand,
  DeleteDataCommand,
  FindDataCommand,
  FlushDataCommand,
  RecentDataCommand,
  UpdateDataCommand,
  UploadResult,
} from "./data.types";

export const DataMapper = {
  /**
   * Converts an upload result to create data response.
   */
  toCreateDataResponse(result: UploadResult): CreateDataResponse {
    return {
      data: {
        created: result.created,
        errors: result.errors,
      },
    };
  },

  /**
   * Converts MongoDB update result to response.
   */
  toUpdateDataResponse(result: UpdateResult): UpdateDataResponse {
    return {
      data: {
        acknowledged: result.acknowledged,
        matched: result.matchedCount,
        modified: result.modifiedCount,
        upserted: result.upsertedCount,
        upserted_id: result.upsertedId?.toString() ?? null,
      },
    };
  },

  /**
   * Converts array of data documents to search response.
   */
  toFindDataResponse(documents: DocumentBase[]): FindDataResponse {
    return { data: documents };
  },

  /**
   * Converts MongoDB delete result to response.
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
   * Converts MongoDB delete result to flush response.
   */
  toFlushDataResponse(result: DeleteResult): DropDataResponse {
    return {
      data: {
        acknowledged: result.acknowledged,
        deletedCount: result.deletedCount,
      },
    };
  },

  /**
   * Converts array of data documents to tail response.
   */
  toTailDataResponse(documents: DocumentBase[]): TailDataResponse {
    return { data: documents };
  },

  /**
   * Converts upload owned data request DTO to domain command.
   */
  toCreateOwnedRecordsCommand(
    body: CreateOwnedDataRequest,
  ): CreateOwnedDataCommand {
    return {
      owner: body.owner,
      collection: new UUID(body.schema),
      data: body.data,
      acl: body.acl,
    };
  },

  /**
   * Converts upload standard data request DTO to domain command.
   */
  toCreateStandardRecordsCommand(
    body: CreateStandardDataRequest,
  ): CreateStandardDataCommand {
    return {
      collection: new UUID(body.schema),
      data: body.data,
    };
  },

  /**
   * Converts update data request DTO to domain command.
   */
  toUpdateDataCommand(dto: UpdateDataRequest): UpdateDataCommand {
    return {
      collection: new UUID(dto.schema),
      filter: dto.filter,
      update: dto.update,
    };
  },

  /**
   * Converts read data request DTO to domain command.
   */
  toFindDataCommand(dto: FindDataRequest): FindDataCommand {
    return {
      collection: new UUID(dto.schema),
      filter: dto.filter,
    };
  },

  /**
   * Converts delete data request DTO to domain command.
   */
  toDeleteDataCommand(dto: DeleteDataRequest): DeleteDataCommand {
    return {
      collection: new UUID(dto.schema),
      filter: dto.filter,
    };
  },

  /**
   * Converts flush data request DTO to domain command.
   */
  toFlushCollectionCommand(params: FlushDataRequest): FlushDataCommand {
    return {
      collection: new UUID(params.schema),
    };
  },

  /**
   * Converts path parameter to flush collection data command.
   */
  toFlushDataCommand(params: DataSchemaByIdRequestParams): FlushDataCommand {
    return {
      collection: new UUID(params.id),
    };
  },

  /**
   * Converts recent data request to domain command.
   */
  toRecentDataCommand(
    params: TailDataRequestParams,
    query: TailDataRequestQuery,
  ): RecentDataCommand {
    return {
      collection: new UUID(params.id),
      limit: query.limit,
    };
  },
};
