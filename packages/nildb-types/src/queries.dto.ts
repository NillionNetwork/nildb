import z from "zod";
import { PaginatedResponse, PaginationQuerySchema } from "./pagination.dto.js";
import { ApiSuccessResponse } from "./responses.dto.js";

/**
 * MongoDB aggregation pipeline variable validation.
 */
const PATH_EXPRESSION = /^\$(\.[$a-zA-Z][a-zA-Z0-9-_]+(\[\d+])*)+$/;
const VariablePath = z.string().regex(PATH_EXPRESSION).meta({
  type: "string",
  pattern: "^\\$(\\.[$a-zA-Z][a-zA-Z0-9-_]+(\\[\\d+])*)+$",
  description: "A Jq-like path for variable substitution",
  example: "$.field.subfield[0]",
});

/**
 * Query variable configuration validator.
 */
export const QueryVariableValidator = z.object({
  path: VariablePath,
  description: z.string().optional(),
});

/**
 * Query creation request.
 */
export const CreateQueryRequest = z
  .object({
    _id: z.uuid(),
    name: z.string().min(1).max(100),
    collection: z.uuid(),
    variables: z.record(z.string(), QueryVariableValidator),
    pipeline: z.array(z.record(z.string(), z.unknown())),
  })
  .meta({ ref: "CreateQueryRequest" });
export type CreateQueryRequest = z.infer<typeof CreateQueryRequest>;

/**
 * Query creation response.
 */
export const CreateQueryResponse = z.string();
export type CreateQueryResponse = z.infer<typeof CreateQueryResponse>;

/**
 * Query document data.
 */
export const QueryDocumentResponse = z.object({
  _id: z.uuid(),
  name: z.string().min(1).max(100),
  collection: z.uuid(),
});
export type QueryDocumentResponse = z.infer<typeof QueryDocumentResponse>;

/**
 * Queries list request query.
 */
export const ReadQueriesRequestQuery = PaginationQuerySchema;
export type ReadQueriesRequestQuery = z.infer<typeof ReadQueriesRequestQuery>;

/**
 * Queries list response.
 */
export const ReadQueriesResponse = PaginatedResponse(
  QueryDocumentResponse,
).meta({
  ref: "ReadQueriesResponse",
});
export type ReadQueriesResponse = z.infer<typeof ReadQueriesResponse>;

/**
 * Read query response.
 */
export const ReadQueryResponse = ApiSuccessResponse(QueryDocumentResponse).meta(
  {
    ref: "ReadQueryResponse",
  },
);
export type ReadQueryResponse = z.infer<typeof ReadQueryResponse>;

/**
 * Query ID path parameters.
 */
export const ByIdRequestParams = z
  .object({
    id: z.uuid(),
  })
  .meta({ ref: "ByIdRequestParams" });
export type ByIdRequestParams = z.infer<typeof ByIdRequestParams>;

/**
 * Query run results request query.
 */
export const ReadQueryRunByIdRequestQuery = PaginationQuerySchema;
export type ReadQueryRunByIdRequestQuery = z.infer<
  typeof ReadQueryRunByIdRequestQuery
>;

/**
 * Query deletion request.
 */
export const DeleteQueryRequest = z
  .object({
    id: z.uuid(),
  })
  .meta({ ref: "DeleteQueryRequest" });
export type DeleteQueryRequest = z.infer<typeof DeleteQueryRequest>;

/**
 * Query deletion response.
 */
export const DeleteQueryResponse = z.string();
export type DeleteQueryResponse = z.infer<typeof DeleteQueryResponse>;

/**
 * Query execution request.
 */
export const RunQueryRequest = z
  .object({
    _id: z.uuid(),
    variables: z.record(z.string(), z.unknown()),
  })
  .meta({ ref: "RunQueryRequest" });
export type RunQueryRequest = z.infer<typeof RunQueryRequest>;

/**
 * Query execution response.
 */
export const RunQueryResponse = ApiSuccessResponse(z.uuid()).meta({
  ref: "RunQueryResponse",
});
export type RunQueryResponse = z.infer<typeof RunQueryResponse>;

/**
 * Query execution status.
 */
export const RunQueryResultStatus = z.enum([
  "pending",
  "running",
  "complete",
  "error",
]);
export type RunQueryResultStatus = z.infer<typeof RunQueryResultStatus>;

/**
 * Query job data.
 */
const ReadQueryRunByIdDto = z.object({
  _id: z.uuid(),
  query: z.uuid(),
  status: RunQueryResultStatus,
  started: z.iso.datetime().optional(),
  completed: z.iso.datetime().optional(),
  result: z.array(z.any()).optional(),
  errors: z.array(z.string()).optional(),
});

/**
 * Query run results response.
 */
export const ReadQueryRunByIdResponse = z
  .object({
    data: ReadQueryRunByIdDto,
    pagination: z
      .object({
        total: z.number().int().min(0),
        limit: z.number().int().min(1),
        offset: z.number().int().min(0),
      })
      .optional(),
  })
  .meta({
    ref: "ReadQueryRunByIdResponse",
  });
export type ReadQueryRunByIdResponse = z.infer<typeof ReadQueryRunByIdResponse>;
