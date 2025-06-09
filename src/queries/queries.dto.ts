import { StatusCodes } from "http-status-codes";
import z from "zod";
import { ApiSuccessResponse } from "#/common/handler";
import { DidSchema, Uuid } from "#/common/types";

/**
 * Variable validation schemas for MongoDB aggregation pipeline variables.
 */
const PATH_EXPRESSION = /^\$(\.[$a-zA-Z][a-zA-Z0-9-_]+(\[\d+])*)+$/;
const VariablePath = z
  .string()
  .transform((path) => PATH_EXPRESSION.exec(path))
  .refine((match) => match !== null, "invalid PATH")
  .transform((match) => match[0]);

/**
 * Schema for validating query variable configuration.
 * Variables define replaceable parameters in MongoDB aggregation pipelines.
 */
export const QueryVariableValidator = z.object({
  path: VariablePath,
  description: z.string().optional(),
});

/**
 * Request schema for creating a new MongoDB aggregation query.
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
export const AddQueryRequest = z
  .object({
    _id: Uuid,
    name: z.string(),
    schema: Uuid,
    variables: z.record(z.string(), QueryVariableValidator),
    pipeline: z.array(z.record(z.string(), z.unknown())),
  })
  .openapi({ ref: "AddQueryRequest" });
export type AddQueryRequest = z.infer<typeof AddQueryRequest>;

/**
 * Response for successful query creation.
 *
 * Returns HTTP 201 Created with empty body to indicate
 * the query was created successfully.
 */
export const AddQueryResponse = new Response(null, {
  status: StatusCodes.CREATED,
});
export type AddQueryResponse = typeof AddQueryResponse;

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
  owner: DidSchema,
  name: z.string(),
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
 * Request schema for deleting a query by ID.
 *
 * @example
 * {
 *   "id": "123e4567-e89b-12d3-a456-426614174000"
 * }
 */
export const DeleteQueryRequest = z
  .object({
    id: Uuid,
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
 * Request schema for executing a query with variable substitution.
 *
 * @example
 * {
 *   "id": "123e4567-e89b-12d3-a456-426614174000",
 *   "variables": {
 *     "minAge": 25,
 *     "status": "active"
 *   },
 *   "background": false
 * }
 */
export const ExecuteQueryRequest = z
  .object({
    id: Uuid,
    variables: z.record(z.string(), z.unknown()),
    background: z.boolean().optional(),
  })
  .openapi({ ref: "ExecuteQueryRequest" });
export type ExecuteQueryRequest = z.infer<typeof ExecuteQueryRequest>;

/**
 * Union type for query execution results.
 * Either returns a job ID for background execution or direct results.
 */
export const QueryExecutionResult = z.union([
  z.object({
    jobId: z.string().uuid(),
  }),
  z.array(z.record(z.string(), z.unknown())),
]);

/**
 * Response schema for query execution.
 *
 * @example
 * // Synchronous execution result
 * {
 *   "data": [
 *     {"_id": "user1", "name": "Alice", "age": 30},
 *     {"_id": "user2", "name": "Bob", "age": 25}
 *   ]
 * }
 *
 * @example
 * // Background execution result
 * {
 *   "data": {
 *     "jobId": "456e7890-e89b-12d3-a456-426614174001"
 *   }
 * }
 */
export const ExecuteQueryResponse = ApiSuccessResponse(
  QueryExecutionResult,
).openapi({ ref: "ExecuteQueryResponse" });

export type ExecuteQueryResponse = z.infer<typeof ExecuteQueryResponse>;

/**
 * Query job status enumeration.
 * Represents the current state of a background query execution.
 */
export const QueryJobStatusSchema = z.enum(["pending", "running", "complete"]);
export type QueryJobStatus = z.infer<typeof QueryJobStatusSchema>;

/**
 * Request schema for getting query job status and results.
 *
 * @example
 * {
 *   "id": "123e4567-e89b-12d3-a456-426614174000"
 * }
 */
export const QueryJobRequest = z
  .object({
    id: Uuid,
  })
  .openapi({ ref: "QueryJobRequest" });
export type QueryJobRequest = z.infer<typeof QueryJobRequest>;

/**
 * Query job document schema for API responses.
 *
 * Represents a background query execution job with status,
 * timing information, and results when complete.
 */
const QueryJobResponse = z.object({
  _id: z.string().uuid(),
  _created: z.string().datetime(),
  _updated: z.string().datetime(),
  queryId: z.string().uuid(),
  status: QueryJobStatusSchema,
  startedAt: z.string().datetime().optional(),
  endedAt: z.string().datetime().optional(),
  result: z.unknown().optional(),
  errors: z.array(z.string()).optional(),
});

/**
 * Response schema for query job status retrieval.
 *
 * @example
 * {
 *   "data": {
 *     "_id": "456e7890-e89b-12d3-a456-426614174001",
 *     "_created": "2023-12-01T10:00:00.000Z",
 *     "_updated": "2023-12-01T10:05:00.000Z",
 *     "queryId": "123e4567-e89b-12d3-a456-426614174000",
 *     "status": "complete",
 *     "startedAt": "2023-12-01T10:00:00.000Z",
 *     "endedAt": "2023-12-01T10:05:00.000Z",
 *     "result": [
 *       {"_id": "user1", "count": 42}
 *     ]
 *   }
 * }
 */
export const GetQueryJobResponse = ApiSuccessResponse(QueryJobResponse).openapi(
  {
    ref: "GetQueryJobResponse",
  },
);
export type GetQueryJobResponse = z.infer<typeof GetQueryJobResponse>;
