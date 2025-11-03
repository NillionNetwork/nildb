import type { DeleteResult, UpdateResult } from "mongodb";
import { UUID } from "mongodb";
import type { Logger } from "pino";
import { normalizeIdentifier } from "#/common/did-utils";
import type { DocumentBase } from "#/common/mongo";
import type { Paginated } from "#/common/pagination.dto";
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
    requesterId: string,
    log: Logger,
  ): CreateOwnedDataCommand {
    return {
      owner: normalizeIdentifier(body.owner, log),
      collection: new UUID(body.collection),
      data: body.data,
      acl: {
        ...body.acl,
        grantee: normalizeIdentifier(body.acl.grantee, log),
      },
      requesterId,
    };
  },

  /**
   * Converts upload standard data request DTO to domain command.
   */
  toCreateStandardRecordsCommand(
    body: CreateStandardDataRequest,
    requesterId: string,
  ): CreateStandardDataCommand {
    return {
      collection: new UUID(body.collection),
      data: body.data,
      requesterId,
    };
  },

  /**
   * Converts update data request DTO to domain command.
   */
  toUpdateDataCommand(
    dto: UpdateDataRequest,
    requesterId: string,
  ): UpdateDataCommand {
    return {
      collection: new UUID(dto.collection),
      filter: dto.filter,
      update: dto.update,
      requesterId,
    };
  },

  /**
   * Converts read data request DTO to domain command.
   */
  toFindDataCommand(
    dto: FindDataRequest,
    requesterId: string,
  ): FindDataCommand {
    return {
      collection: new UUID(dto.collection),
      filter: dto.filter,
      requesterId,
      pagination: {
        limit: dto.pagination?.limit ?? 1_000,
        offset: dto.pagination?.offset ?? 0,
      },
    };
  },

  /**
   * Converts array of data documents to find response.
   */
  toFindDataResponse(
    paginatedResult: Paginated<DocumentBase>,
  ): FindDataResponse {
    return {
      data: paginatedResult.data,
      pagination: {
        total: paginatedResult.total,
        limit: paginatedResult.limit,
        offset: paginatedResult.offset,
      },
    };
  },

  /**
   * Converts delete data request DTO to domain command.
   */
  toDeleteDataCommand(
    dto: DeleteDataRequest,
    requesterId: string,
  ): DeleteDataCommand {
    return {
      collection: new UUID(dto.collection),
      filter: dto.filter,
      requesterId,
    };
  },

  /**
   * Converts flush data request DTO to domain command.
   */
  toFlushCollectionCommand(
    params: FlushDataRequest,
    requesterId: string,
  ): FlushDataCommand {
    return {
      collection: new UUID(params.collection),
      requesterId,
    };
  },

  /**
   * Converts path parameter to flush collection data command.
   */
  toFlushDataCommand(
    params: DataSchemaByIdRequestParams,
    requesterId: string,
  ): FlushDataCommand {
    return {
      collection: new UUID(params.id),
      requesterId,
    };
  },

  /**
   * Converts recent data request to domain command.
   */
  toRecentDataCommand(
    params: TailDataRequestParams,
    query: TailDataRequestQuery,
    requesterId: string,
  ): RecentDataCommand {
    return {
      collection: new UUID(params.id),
      limit: query.limit,
      requesterId,
    };
  },
};
