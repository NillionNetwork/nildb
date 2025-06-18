import type { DidString } from "@nillion/nuc";
import { UUID } from "mongodb";
import type {
  ByIdRequestParams,
  CreateQueryRequest,
  DeleteQueryRequest,
  ReadQueriesResponse,
  ReadQueryRunByIdResponse,
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

export const QueriesDataMapper = {
  /**
   * Converts a query document to response DTO.
   */
  toQueryDocumentResponse(
    document: QueryDocument,
  ): ReadQueriesResponse["data"][0] {
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
  toRunQueryCommand(dto: RunQueryRequest): RunQueryCommand {
    return {
      _id: new UUID(dto._id),
      variables: dto.variables,
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
    owner: DidString,
  ): Omit<QueryDocument, "_id" | "_created" | "_updated"> {
    return {
      owner,
      name: request.name,
      collection: new UUID(request.collection),
      variables: request.variables,
      pipeline: request.pipeline,
    };
  },

  /**
   * Converts add query request DTO to domain command.
   */
  toCreateQueryCommand(
    body: CreateQueryRequest,
    owner: DidString,
  ): AddQueryCommand {
    return {
      _id: new UUID(body._id),
      name: body.name,
      collection: new UUID(body.collection),
      variables: body.variables,
      pipeline: body.pipeline,
      owner,
    };
  },

  /**
   * Converts delete query request DTO to domain command.
   */
  toDeleteQueryCommand(dto: DeleteQueryRequest): DeleteQueryCommand {
    return {
      _id: new UUID(dto.id),
    };
  },

  /**
   * Converts query ID params to delete command.
   */
  toDeleteQueryByIdCommand(params: ByIdRequestParams): DeleteQueryCommand {
    return {
      _id: new UUID(params.id),
    };
  },
};
