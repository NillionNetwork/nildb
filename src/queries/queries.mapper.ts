import { UUID } from "mongodb";
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
   * Converts array of query documents to list response DTO.
   */
  toGetQueriesResponse(documents: QueryDocument[]): ReadQueriesResponse {
    return {
      data: documents.map((doc) => this.toQueryDocumentResponse(doc)),
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
   * Converts a query job document to response DTO.
   */
  toGetQueryRunResultByResponse(
    document: RunQueryJobDocument,
  ): ReadQueryRunByIdResponse {
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
