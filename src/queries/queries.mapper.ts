import type { DidString } from "@nillion/nuc";
import { UUID } from "mongodb";
import type {
  AddQueryRequest,
  DeleteQueryRequest,
  ExecuteQueryRequest,
  ExecuteQueryResponse,
  GetQueriesResponse,
  GetQueryJobResponse,
  QueryJobRequest,
} from "./queries.dto";
import type {
  AddQueryCommand,
  DeleteQueryCommand,
  ExecuteQueryCommand,
  GetQueryJobCommand,
  QueryDocument,
  QueryJobDocument,
} from "./queries.types";

/**
 * Transforms data between HTTP DTOs and domain models.
 *
 * Centralizes all data transformations to maintain clean layer boundaries.
 * Higher layers (controllers) use these functions to convert domain
 * models to DTOs for API responses.
 */
export const QueriesDataMapper = {
  /**
   * Converts a query document to response DTO.
   * Serializes dates to ISO strings for JSON compatibility.
   *
   * @param document - Query document from repository
   * @returns Query response DTO
   */
  toQueryDocumentResponse(
    document: QueryDocument,
  ): GetQueriesResponse["data"][0] {
    return {
      _id: document._id.toString(),
      _created: document._created.toISOString(),
      _updated: document._updated.toISOString(),
      owner: document.owner,
      name: document.name,
      schema: document.schema.toString(),
      variables: document.variables,
      pipeline: document.pipeline,
    };
  },

  /**
   * Converts array of query documents to list response DTO.
   *
   * @param documents - Array of query documents
   * @returns List queries response DTO
   */
  toGetQueriesResponse(documents: QueryDocument[]): GetQueriesResponse {
    return {
      data: documents.map((doc) => this.toQueryDocumentResponse(doc)),
    };
  },

  /**
   * Converts a query job document to response DTO.
   * Serializes dates to ISO strings for JSON compatibility.
   *
   * @param document - Query job document from repository
   * @returns Query job response DTO
   */
  toQueryJobResponse(document: QueryJobDocument): GetQueryJobResponse {
    return {
      data: {
        _id: document._id.toString(),
        _created: document._created.toISOString(),
        _updated: document._updated.toISOString(),
        queryId: document.queryId.toString(),
        status: document.status,
        startedAt: document.startedAt?.toISOString(),
        endedAt: document.endedAt?.toISOString(),
        result: document.result,
        errors: document.errors,
      },
    };
  },

  /**
   * Converts query execution result to response DTO.
   *
   * @param result - Query execution result (job ID or direct data)
   * @returns Execute query response DTO
   */
  toExecuteQueryResponse(
    result: { jobId: string } | Record<string, unknown>[],
  ): ExecuteQueryResponse {
    return {
      data: result,
    };
  },

  /**
   * Converts add query request DTO to domain model.
   * Adds system fields and converts UUIDs.
   *
   * @param request - Add query request DTO
   * @param owner - Query owner DID
   * @returns Complete query document for repository
   */
  fromAddQueryRequest(
    request: AddQueryRequest,
    owner: DidString,
  ): Omit<QueryDocument, "_id" | "_created" | "_updated"> {
    return {
      owner,
      name: request.name,
      schema: request.schema,
      variables: request.variables,
      pipeline: request.pipeline,
    };
  },

  /**
   * Converts add query request DTO to domain command.
   *
   * Handles DTO to domain command conversion at the boundary layer.
   *
   * @param dto - Add query request DTO
   * @param owner - Query owner DID
   * @returns Add query domain command
   */
  toAddQueryCommand(dto: AddQueryRequest, owner: DidString): AddQueryCommand {
    return {
      _id: new UUID(dto._id),
      name: dto.name,
      schema: new UUID(dto.schema),
      variables: dto.variables,
      pipeline: dto.pipeline,
      owner,
    };
  },

  /**
   * Converts execute query request DTO to domain command.
   *
   * Handles string to UUID conversion at the boundary layer.
   *
   * @param dto - Execute query request DTO
   * @returns Execute query domain command
   */
  toExecuteQueryCommand(dto: ExecuteQueryRequest): ExecuteQueryCommand {
    return {
      id: new UUID(dto.id),
      variables: dto.variables,
      background: dto.background,
    };
  },

  /**
   * Converts delete query request DTO to domain command.
   *
   * Handles string to UUID conversion at the boundary layer.
   *
   * @param dto - Delete query request DTO
   * @returns Delete query domain command
   */
  toDeleteQueryCommand(dto: DeleteQueryRequest): DeleteQueryCommand {
    return {
      id: new UUID(dto.id),
    };
  },

  /**
   * Converts query job request DTO to domain command.
   *
   * Handles string to UUID conversion at the boundary layer.
   *
   * @param dto - Query job request DTO
   * @returns Get query job domain command
   */
  toGetQueryJobCommand(dto: QueryJobRequest): GetQueryJobCommand {
    return {
      id: new UUID(dto.id),
    };
  },
};
