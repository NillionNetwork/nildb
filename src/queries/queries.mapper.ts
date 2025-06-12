import type { DidString } from "@nillion/nuc";
import { UUID } from "mongodb";
import type {
  ByIdRequestParams,
  CreateQueryRequest,
  DeleteQueryRequest,
  GetQueriesResponse,
  GetQueryRunByIdResponse,
  RunQueryRequest,
  RunQueryResponse,
} from "./queries.dto";
import type {
  AddQueryCommand,
  DeleteQueryCommand,
  GetQueryRunByIdCommand,
  QueryDocument,
  RunQueryCommand,
  RunQueryJobDocument,
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
   * Converts execute query request DTO to domain command.
   *
   * Handles string to UUID conversion at the boundary layer.
   *
   * @param dto - Execute query request DTO
   * @returns Execute query domain command
   */
  toRunQueryCommand(dto: RunQueryRequest): RunQueryCommand {
    return {
      id: new UUID(dto.id),
      variables: dto.variables,
    };
  },

  /**
   * Converts query id to response DTO.
   *
   * @param runId - The query run id used to fetch the result
   * @returns Execute query response DTO
   */
  toRunQueryResponse(runId: UUID): RunQueryResponse {
    return {
      data: runId.toString(),
    };
  },

  /**
   * Converts params to get query run results by id command.
   *
   * Handles path parameter to UUID conversion at the boundary layer.
   *
   * @param params - Job ID params from path parameter
   * @returns Get query job domain command
   */
  toGetQueryRunResultByIdCommand(
    params: ByIdRequestParams,
  ): GetQueryRunByIdCommand {
    return {
      id: new UUID(params.id),
    };
  },

  /**
   * Converts a query job document to response DTO.
   * Serializes dates to ISO strings for JSON compatibility.
   *
   * @param document - Query job document from repository
   * @returns Query job response DTO
   */
  toGetQueryRunResultByResponse(
    document: RunQueryJobDocument,
  ): GetQueryRunByIdResponse {
    return {
      data: {
        _id: document._id.toString(),
        query: document.query.toString(),
        status: document.status,
        started: document.started.toISOString(),
        completed: document.completed.toISOString(),
        result: document.result,
        errors: document.errors,
      },
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
  fromCreateQueryRequest(
    request: CreateQueryRequest,
    owner: DidString,
  ): Omit<QueryDocument, "_id" | "_created" | "_updated"> {
    return {
      owner,
      name: request.name,
      schema: new UUID(request.schema),
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
  toCreateQueryCommand(
    dto: CreateQueryRequest,
    owner: DidString,
  ): AddQueryCommand {
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
   * Converts query ID params to delete command.
   *
   * Handles path parameter to UUID conversion at the boundary layer.
   *
   * @param params - Query ID params from path parameter
   * @returns Delete query domain command
   */
  toDeleteQueryByIdCommand(params: ByIdRequestParams): DeleteQueryCommand {
    return {
      id: new UUID(params.id),
    };
  },
};
