import z from "zod";
import { ApiSuccessResponse } from "#/common/handler";

/**
 * MongoDB aggregation pipeline variable validation.
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
    _id: z.string().uuid(),
    name: z.string().min(1).max(100),
    collection: z.string().uuid(),
    variables: z.record(z.string(), QueryVariableValidator),
    pipeline: z.array(z.record(z.string(), z.unknown())),
  })
  .openapi({ ref: "CreateQueryRequest" });
export type CreateQueryRequest = z.infer<typeof CreateQueryRequest>;

/**
 * Query creation response.
 */
export const CreateQueryResponse = z.string();
export type CreateQueryResponse = z.infer<typeof CreateQueryResponse>;

/**
 * Query document data.
 */
const QueryDocumentResponse = z.object({
  _id: z.string().uuid(),
  name: z.string().min(1).max(100),
  collection: z.string().uuid(),
});

/**
 * Queries list response.
 */
export const ReadQueriesResponse = ApiSuccessResponse(
  z.array(QueryDocumentResponse),
).openapi({
  ref: "ReadQueriesResponse",
});
export type ReadQueriesResponse = z.infer<typeof ReadQueriesResponse>;

/**
 * Read query response.
 */
export const ReadQueryResponse = ApiSuccessResponse(
  QueryDocumentResponse,
).openapi({
  ref: "ReadQueryResponse",
});
export type ReadQueryResponse = z.infer<typeof ReadQueryResponse>;

/**
 * Query ID path parameters.
 */
export const ByIdRequestParams = z
  .object({
    id: z.string().uuid(),
  })
  .openapi({ ref: "ByIdRequestParams" });
export type ByIdRequestParams = z.infer<typeof ByIdRequestParams>;

/**
 * Query deletion request.
 */
export const DeleteQueryRequest = z
  .object({
    id: z.string().uuid(),
  })
  .openapi({ ref: "DeleteQueryRequest" });
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
    _id: z.string().uuid(),
    variables: z.record(z.string(), z.unknown()),
  })
  .openapi({ ref: "RunQueryRequest" });
export type RunQueryRequest = z.infer<typeof RunQueryRequest>;

/**
 * Query execution response.
 */
export const RunQueryResponse = ApiSuccessResponse(z.string().uuid()).openapi({
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
  _id: z.string().uuid(),
  query: z.string().uuid(),
  status: RunQueryResultStatus,
  started: z.string().datetime().optional(),
  completed: z.string().datetime().optional(),
  result: z.unknown().optional(),
  errors: z.array(z.string()).optional(),
});

export const ReadQueryRunByIdResponse = ApiSuccessResponse(
  ReadQueryRunByIdDto,
).openapi({
  ref: "ReadQueryRunByIdResponse",
});
export type ReadQueryRunByIdResponse = z.infer<typeof ReadQueryRunByIdResponse>;
