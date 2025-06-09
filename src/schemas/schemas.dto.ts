import { StatusCodes } from "http-status-codes";
import { z } from "zod";
import { ApiSuccessResponse } from "#/common/handler";
import { DidSchema, Uuid } from "#/common/types";

/**
 * Schema document schema for API responses.
 *
 * Represents a JSON schema definition with metadata
 * for validating data uploads to collections.
 */
export const SchemaDocumentDto = z.object({
  owner: DidSchema,
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
 *
 * @example
 * {
 *   "data": [
 *     {
 *       "owner": "did:nil:037a87f9b010687e23eccb2fc70a474cbb612418cb513a62289eaed6cf1f11ac6b",
 *       "name": "User Profile Schema",
 *       "schema": {
 *         "type": "object",
 *         "properties": {
 *           "name": {"type": "string"},
 *           "age": {"type": "number"}
 *         }
 *       },
 *       "document_type": "standard"
 *     }
 *   ]
 * }
 */
export const ListSchemasResponse = ApiSuccessResponse(SchemaDocuments).openapi({
  ref: "ListSchemasResponse",
});
export type ListSchemasResponse = z.infer<typeof ListSchemasResponse>;

/**
 * Request schema for creating a MongoDB index on a schema collection.
 *
 * @example
 * {
 *   "name": "user_email_idx",
 *   "keys": [
 *     { "email": 1 },
 *     { "created_at": -1 }
 *   ],
 *   "unique": true,
 *   "ttl": 3600
 * }
 */
export const CreateSchemaIndexRequest = z
  .object({
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
 * Request schema for creating a new JSON schema definition.
 *
 * @example
 * {
 *   "_id": "123e4567-e89b-12d3-a456-426614174000",
 *   "name": "User Profile Schema",
 *   "schema": {
 *     "type": "object",
 *     "properties": {
 *       "name": {
 *         "type": "string",
 *         "minLength": 1
 *       },
 *       "age": {
 *         "type": "number",
 *         "minimum": 0
 *       },
 *       "email": {
 *         "type": "string",
 *         "format": "email"
 *       }
 *     },
 *     "required": ["name", "email"]
 *   },
 *   "documentType": "standard"
 * }
 */
export const AddSchemaRequest = z
  .object({
    _id: Uuid,
    name: z.string().min(1),
    schema: z.record(z.string(), z.unknown()),
    documentType: z.union([z.literal("standard"), z.literal("owned")]),
  })
  .openapi({ ref: "AddSchemaRequest" });
export type AddSchemaRequest = z.infer<typeof AddSchemaRequest>;

/**
 * Response for successful schema creation.
 *
 * Returns HTTP 201 Created with empty body to indicate
 * the schema was created successfully.
 */
export const AddSchemaResponse = new Response(null, {
  status: StatusCodes.CREATED,
});

/**
 * Request schema for deleting a schema by ID.
 *
 * @example
 * {
 *   "id": "123e4567-e89b-12d3-a456-426614174000"
 * }
 */
export const DeleteSchemaRequest = z
  .object({
    id: Uuid,
  })
  .openapi({ ref: "DeleteSchemaRequest" });
export type DeleteSchemaRequest = z.infer<typeof DeleteSchemaRequest>;

/**
 * Response for successful schema deletion.
 *
 * Returns HTTP 204 No Content with empty body to indicate
 * the schema was deleted successfully.
 */
export const DeleteSchemaResponse = new Response(null, {
  status: StatusCodes.NO_CONTENT,
});

/**
 * MongoDB collection index information schema.
 *
 * Represents index metadata for a schema collection
 * including keys, constraints, and performance settings.
 */
export const CollectionIndexDto = z.object({
  v: z.number(),
  key: z.record(z.string(), z.union([z.string(), z.number()])),
  name: z.string(),
  unique: z.boolean(),
});

/**
 * Schema metadata schema for collection statistics.
 *
 * Provides information about a schema's collection including
 * document counts, storage size, and index information.
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
 *
 * @example
 * {
 *   "data": {
 *     "id": "123e4567-e89b-12d3-a456-426614174000",
 *     "count": 1250,
 *     "size": 2048576,
 *     "first_write": "2023-11-01T10:00:00.000Z",
 *     "last_write": "2023-12-01T15:30:00.000Z",
 *     "indexes": [
 *       {
 *         "v": 2,
 *         "key": { "_id": 1 },
 *         "name": "_id_",
 *         "unique": true
 *       },
 *       {
 *         "v": 2,
 *         "key": { "email": 1 },
 *         "name": "user_email_idx",
 *         "unique": true
 *       }
 *     ]
 *   }
 * }
 */
export const ReadSchemaMetadataResponse = ApiSuccessResponse(
  SchemaMetadataDto,
).openapi({ ref: "ReadSchemaMetadataResponse" });
export type ReadSchemaMetadataResponse = z.infer<
  typeof ReadSchemaMetadataResponse
>;
