import { UUID } from "mongodb";
import type { Paginated, PaginationQuery } from "#/common/pagination.dto";
import type {
  ByIdRequestParams,
  CreateQueryRequest,
  DeleteQueryRequest,
  QueryDocumentResponse,
  ReadQueriesResponse,
  ReadQueryResponse,
  ReadQueryRunByIdResponse,
  RunQueryRequest,
  RunQueryResponse,
} from "./queries.dto";
import type {
  AddQueryCommand,
  DeleteQueryCommand,
  GetQueryRunByIdCommand,
  QueryDocument,
  QueryVariable,
  ReadQueryByIdCommand,
  RunQueryCommand,
  RunQueryJobDocument,
} from "./queries.types";

export const QueriesDataMapper = {
  /**
   * Converts a query document to response DTO.
   */
  toQueryDocumentResponse(document: QueryDocument): QueryDocumentResponse {
    return {
      _id: document._id.toString(),
      name: document.name,
      collection: document.collection.toString(),
    };
  },

  /**
   * Converts a paginated result of query documents into a paginated API response.
   *
   * @param paginatedResult The paginated data from the service layer.
   * @returns The final API response object for listing queries.
   */
  toGetQueriesResponse(
    paginatedResult: Paginated<QueryDocument>,
  ): ReadQueriesResponse {
    return {
      data: paginatedResult.data.map((doc) =>
        this.toQueryDocumentResponse(doc),
      ),
      pagination: {
        total: paginatedResult.total,
        limit: paginatedResult.limit,
        offset: paginatedResult.offset,
      },
    };
  },

  /**
   * Converts execute query request DTO to domain command.
   */
  toRunQueryCommand(
    dto: RunQueryRequest,
    requesterId: string,
  ): RunQueryCommand {
    return {
      _id: new UUID(dto._id),
      variables: dto.variables,
      requesterId,
    };
  },

  /**
   * Converts query id to response DTO.
   */
  toRunQueryResponse(runId: UUID): RunQueryResponse {
    return {
      data: runId.toString(),
    };
  },

  /**
   * Converts params to get query run results by id command.
   */
  toGetQueryRunResultByIdCommand(
    params: ByIdRequestParams,
  ): GetQueryRunByIdCommand {
    return {
      _id: new UUID(params.id),
    };
  },

  /**
   * Converts the service-layer query run result into the final paginated API response.
   *
   * @param serviceResult The result object from the service layer, containing the document and total count.
   * @param pagination The pagination parameters used for the request.
   * @returns The final API response object for the query run result.
   */
  toGetQueryRunResultByIdResponse(
    serviceResult: { document: RunQueryJobDocument; total: number },
    pagination: PaginationQuery,
  ): ReadQueryRunByIdResponse {
    const { document, total } = serviceResult;
    return {
      data: {
        _id: document._id.toString(),
        query: document.query.toString(),
        status: document.status,
        started: document.started.toISOString(),
        completed: document.completed.toISOString(),
        result: document.result as unknown[],
        errors: document.errors,
      },
      pagination: {
        total,
        limit: pagination.limit,
        offset: pagination.offset,
      },
    };
  },

  /**
   * Converts add query request DTO to domain model.
   */
  fromCreateQueryRequest(
    request: CreateQueryRequest,
    owner: string,
  ): Omit<QueryDocument, "_id" | "_created" | "_updated"> {
    return {
      owner,
      name: request.name,
      collection: new UUID(request.collection),
      variables: request.variables as Record<string, QueryVariable>,
      pipeline: request.pipeline,
    };
  },

  /**
   * Converts add query request DTO to domain command.
   */
  toCreateQueryCommand(
    body: CreateQueryRequest,
    owner: string,
  ): AddQueryCommand {
    return {
      _id: new UUID(body._id),
      name: body.name,
      collection: new UUID(body.collection),
      variables: body.variables as Record<string, QueryVariable>,
      pipeline: body.pipeline,
      owner,
    };
  },

  /**
   * Converts delete query request DTO to domain command.
   */
  toDeleteQueryCommand(
    dto: DeleteQueryRequest,
    requesterId: string,
  ): DeleteQueryCommand {
    return {
      _id: new UUID(dto.id),
      requesterId,
    };
  },

  /**
   * Converts query ID params to delete command.
   */
  toDeleteQueryByIdCommand(
    params: ByIdRequestParams,
    requesterId: string,
  ): DeleteQueryCommand {
    return {
      _id: new UUID(params.id),
      requesterId,
    };
  },

  /**
   * Converts query ID params to read query command.
   */
  toReadQueryByIdCommand(
    params: ByIdRequestParams,
    requesterId: string,
  ): ReadQueryByIdCommand {
    return {
      _id: new UUID(params.id),
      requesterId,
    };
  },

  /**
   * Converts a query document to response DTO.
   */
  toReadQueryResponse(document: QueryDocument): ReadQueryResponse {
    return {
      data: this.toQueryDocumentResponse(document),
    };
  },
};
