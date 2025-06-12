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

export const QueriesDataMapper = {
  /**
   * Converts a query document to response DTO.
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
   */
  toGetQueriesResponse(documents: QueryDocument[]): GetQueriesResponse {
    return {
      data: documents.map((doc) => this.toQueryDocumentResponse(doc)),
    };
  },

  /**
   * Converts execute query request DTO to domain command.
   */
  toRunQueryCommand(dto: RunQueryRequest): RunQueryCommand {
    return {
      id: new UUID(dto.id),
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
      id: new UUID(params.id),
    };
  },

  /**
   * Converts a query job document to response DTO.
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
   */
  toCreateQueryCommand(
    body: CreateQueryRequest,
    owner: DidString,
  ): AddQueryCommand {
    return {
      _id: new UUID(body._id),
      name: body.name,
      schema: new UUID(body.schema),
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
      id: new UUID(dto.id),
    };
  },

  /**
   * Converts query ID params to delete command.
   */
  toDeleteQueryByIdCommand(params: ByIdRequestParams): DeleteQueryCommand {
    return {
      id: new UUID(params.id),
    };
  },
};
