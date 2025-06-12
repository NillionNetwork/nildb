import { StatusCodes } from "http-status-codes";
import { z } from "zod";
import { ApiSuccessResponse } from "#/common/handler";
import { Did, Uuid } from "#/common/types";

/**
 * Schema document schema for API responses.
 */
export const SchemaDocumentDto = z.object({
  owner: Did,
  name: z.string(),
  schema: z.record(z.string(), z.unknown()),
  document_type: z.enum(["standard", "owned"]),
});

/**
 * Array of schema documents for list operations.
 */
export const SchemaDocuments = z.array(SchemaDocumentDto);

/**
 * Response schema for listing builder schemas.
 */
export const ListSchemasResponse = ApiSuccessResponse(SchemaDocuments).openapi({
  ref: "ListSchemasResponse",
});
export type ListSchemasResponse = z.infer<typeof ListSchemasResponse>;

/**
 * Request schema for creating a MongoDB index on a schema collection.
 */
export const CreateSchemaIndexRequest = z
  .object({
    schema: z.string().uuid(),
    name: z.string().min(4),
    keys: z.array(
      z
        .record(z.string(), z.union([z.literal(1), z.literal(-1)]))
        .refine(
          (obj) => Object.keys(obj).length === 1,
          "Each object must have exactly one key: [{ _id: 1 }, { foo: -1 }]",
        ),
    ),
    unique: z.boolean(),
    ttl: z.number().optional(),
  })
  .openapi({ ref: "CreateSchemaIndexRequest" });
export type CreateSchemaIndexRequest = z.infer<typeof CreateSchemaIndexRequest>;

/**
 *
 */
export const DropSchemaIndexParams = z.object({
  id: Uuid,
  name: z.string().min(4).max(50),
});

/**
 *
 */
export type DropSchemaIndexParams = z.infer<typeof DropSchemaIndexParams>;

/**
 *
 */
export const DropSchemaIndexResponse = new Response(null, {
  status: StatusCodes.NO_CONTENT,
});

/**
 * Request schema for creating a new JSON schema definition.
 */
export const CreateSchemaRequest = z
  .object({
    _id: Uuid,
    name: z.string().min(1),
    schema: z.record(z.string(), z.unknown()),
    documentType: z.union([z.literal("standard"), z.literal("owned")]),
  })
  .openapi({ ref: "CreateSchemaRequest" });
export type CreateSchemaRequest = z.infer<typeof CreateSchemaRequest>;

/**
 * Response for successful schema creation.
 */
export const CreateSchemaResponse = new Response(null, {
  status: StatusCodes.CREATED,
});

/**
 * Request params for deleting a schema by ID.
 */
export const DeleteSchemaRequestParams = z
  .object({
    id: Uuid,
  })
  .openapi({ ref: "DeleteSchemaRequestParams" });
export type DeleteSchemaRequestParams = z.infer<
  typeof DeleteSchemaRequestParams
>;

/**
 * Response for successful schema deletion.
 */
export const DeleteSchemaResponse = new Response(null, {
  status: StatusCodes.NO_CONTENT,
});

export const ReadSchemaMetadataRequestParams = z
  .object({
    id: Uuid,
  })
  .openapi({ ref: "ReadSchemaMetadataRequestParams" });
export type ReadSchemaMetadataRequestParams = z.infer<
  typeof ReadSchemaMetadataRequestParams
>;

/**
 * MongoDB collection index information schema.
 */
export const CollectionIndexDto = z.object({
  v: z.number(),
  key: z.record(z.string(), z.union([z.string(), z.number()])),
  name: z.string(),
  unique: z.boolean(),
});

/**
 * Schema metadata schema for collection statistics.
 */
export const SchemaMetadataDto = z.object({
  id: z.string().uuid(),
  count: z.number(),
  size: z.number(),
  first_write: z.string().datetime(),
  last_write: z.string().datetime(),
  indexes: z.array(CollectionIndexDto),
});

/**
 * Response schema for schema metadata retrieval.
 */
export const ReadSchemaMetadataResponse = ApiSuccessResponse(
  SchemaMetadataDto,
).openapi({ ref: "ReadSchemaMetadataResponse" });
export type ReadSchemaMetadataResponse = z.infer<
  typeof ReadSchemaMetadataResponse
>;
