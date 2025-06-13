import { StatusCodes } from "http-status-codes";
import z from "zod";
import { ApiSuccessResponse } from "#/common/handler";
import { Did } from "#/common/types";

/**
 * Variable validation schemas for MongoDB aggregation pipeline variables.
 */
const PATH_EXPRESSION = /^\$(\.[$a-zA-Z][a-zA-Z0-9-_]+(\[\d+])*)+$/;
const VariablePath = z
  .string()
  .transform((path) => PATH_EXPRESSION.exec(path))
  .refine((match) => match !== null, "invalid PATH")
  .transform((match) => match[0])
  .openapi({
    type: "string",
    pattern: "^\\$(\\.[$a-zA-Z][a-zA-Z0-9-_]+(\\[\\d+])*)+$",
    description: "Jq-like path for variable subsitution",
    example: "$.field.subfield[0]",
  });

/**
 * Schema for validating query variable configuration.
 * Variables define replaceable parameters in MongoDB aggregation pipelines.
 */
export const QueryVariableValidator = z.object({
  path: VariablePath,
  description: z.string().optional(),
});

/**
 * Request schema for creating a new query.
 *
 * @example
 * {
 *   "_id": "123e4567-e89b-12d3-a456-426614174000",
 *   "name": "User Analytics Query",
 *   "schema": "456e7890-e89b-12d3-a456-426614174001",
 *   "variables": {
 *     "minAge": {
 *       "path": "$.age",
 *       "description": "Minimum age filter"
 *     }
 *   },
 *   "pipeline": [
 *     { "$match": { "age": { "$gte": "{{minAge}}" } } },
 *     { "$group": { "_id": null, "count": { "$sum": 1 } } }
 *   ]
 * }
 */
export const CreateQueryRequest = z
  .object({
    _id: z.string().uuid(),
    name: z.string().min(1).max(100),
    schema: z.string().uuid(),
    variables: z.record(z.string(), QueryVariableValidator),
    pipeline: z.array(z.record(z.string(), z.unknown())),
  })
  .openapi({ ref: "CreateQueryRequest" });
export type CreateQueryRequest = z.infer<typeof CreateQueryRequest>;

/**
 * Response for successful query creation.
 *
 * Returns HTTP 201 Created with empty body to indicate
 * the query was created successfully.
 */
export const CreateQueryResponse = new Response(null, {
  status: StatusCodes.CREATED,
});
export type CreateQueryResponse = typeof CreateQueryResponse;

/**
 * Query document schema for API responses.
 *
 * Represents a MongoDB aggregation query with metadata
 * and dates serialized as ISO strings for JSON compatibility.
 */
const QueryDocumentResponse = z.object({
  _id: z.string().uuid(),
  _created: z.string().datetime(),
  _updated: z.string().datetime(),
  owner: Did,
  name: z.string().min(1).max(100),
  schema: z.string().uuid(),
  variables: z.record(z.string(), QueryVariableValidator),
  pipeline: z.array(z.record(z.string(), z.unknown())),
});

/**
 * Response schema for listing builder queries.
 *
 * @example
 * {
 *   "data": [
 *     {
 *       "_id": "123e4567-e89b-12d3-a456-426614174000",
 *       "_created": "2023-12-01T10:00:00.000Z",
 *       "_updated": "2023-12-01T10:00:00.000Z",
 *       "owner": "did:nil:037a87f9b010687e23eccb2fc70a474cbb612418cb513a62289eaed6cf1f11ac6b",
 *       "name": "User Analytics Query",
 *       "schema": "456e7890-e89b-12d3-a456-426614174001",
 *       "variables": {},
 *       "pipeline": [{"$match": {"active": true}}]
 *     }
 *   ]
 * }
 */
export const GetQueriesResponse = ApiSuccessResponse(
  z.array(QueryDocumentResponse),
).openapi({
  ref: "GetQueriesResponse",
});
export type GetQueriesResponse = z.infer<typeof GetQueriesResponse>;

/**
 * Path parameters for query by id.
 *
 * @example
 * VERB /v1/queries/:id
 */
export const ByIdRequestParams = z
  .object({
    id: z.string().uuid(),
  })
  .openapi({ ref: "ByIdRequestParams" });
export type ByIdRequestParams = z.infer<typeof ByIdRequestParams>;

/**
 * Request schema for deleting a query by ID.
 *
 * @example
 * {
 *   "id": "123e4567-e89b-12d3-a456-426614174000"
 * }
 */
export const DeleteQueryRequest = z
  .object({
    id: z.string().uuid(),
  })
  .openapi({ ref: "DeleteQueryRequest" });
export type DeleteQueryRequest = z.infer<typeof DeleteQueryRequest>;

/**
 * Response for successful query deletion.
 *
 * Returns HTTP 204 No Content with empty body to indicate
 * the query was deleted successfully.
 */
export const DeleteQueryResponse = new Response(null, {
  status: StatusCodes.NO_CONTENT,
});
export type DeleteQueryResponse = typeof DeleteQueryResponse;

/**
 * Request schema for starting a query run with variable substitution.
 *
 * @example
 * {
 *   "id": "123e4567-e89b-12d3-a456-426614174000",
 *   "variables": {
 *     "minAge": 25,
 *     "status": "active"
 *   }
 * }
 */
export const RunQueryRequest = z
  .object({
    id: z.string().uuid(),
    variables: z.record(z.string(), z.unknown()),
  })
  .openapi({ ref: "RunQueryRequest" });
export type RunQueryRequest = z.infer<typeof RunQueryRequest>;

/**
 * Run query response schema.
 *
 * @example
 * {
 *   "data": "456e7890-e89b-12d3-a456-426614174001"
 * }
 */
export const RunQueryResponse = ApiSuccessResponse(z.string().uuid()).openapi({
  ref: "RunQueryResponse",
});
export type RunQueryResponse = z.infer<typeof RunQueryResponse>;

/**
 * The current state of a query run.
 */
export const RunQueryResultStatus = z.enum(["pending", "running", "complete"]);
export type RunQueryResultStatus = z.infer<typeof RunQueryResultStatus>;

/**
 * Query job document schema for API responses.
 *
 * Represents a background query execution job with status,
 * timing information, and results when complete.
 */
const GetQueryRunByIdDto = z.object({
  _id: z.string().uuid(),
  query: z.string().uuid(),
  status: RunQueryResultStatus,
  started: z.string().datetime().optional(),
  completed: z.string().datetime().optional(),
  result: z.unknown().optional(),
  errors: z.array(z.string()).optional(),
});

export const GetQueryRunByIdResponse = ApiSuccessResponse(
  GetQueryRunByIdDto,
).openapi({
  ref: "GetQueryRunByIdResponse",
});
export type GetQueryRunByIdResponse = z.infer<typeof GetQueryRunByIdResponse>;
