import { StatusCodes } from "http-status-codes";
import { z } from "zod";
import { ApiSuccessResponse } from "#/common/handler";
import { Did, Uuid } from "#/common/types";

/**
 *
 */
export const CollectionDocumentDto = z.object({
  owner: Did,
  type: z.enum(["standard", "owned"]),
  name: z.string(),
  schema: z.record(z.string(), z.unknown()),
});

/**
 *
 */
export const CollectionDocuments = z.array(CollectionDocumentDto);

/**
 *
 */
export const ListCollectionsResponse = ApiSuccessResponse(
  CollectionDocuments,
).openapi({
  ref: "ListCollectionsResponse",
});
export type ListCollectionsResponse = z.infer<typeof ListCollectionsResponse>;

/**
 *
 */
export const CreateCollectionIndexRequest = z
  .object({
    collection: z.string().uuid(),
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
  .openapi({ ref: "CreateCollectionIndexRequest" });

/**
 *
 */
export type CreateCollectionIndexRequest = z.infer<
  typeof CreateCollectionIndexRequest
>;

/**
 *
 */
export const DropCollectionIndexParams = z.object({
  id: Uuid,
  name: z.string().min(4).max(50),
});

/**
 *
 */
export type DropCollectionIndexParams = z.infer<
  typeof DropCollectionIndexParams
>;

/**
 *
 */
export const DropCollectionIndexResponse = new Response(null, {
  status: StatusCodes.NO_CONTENT,
});

/**
 *
 */
export const CreateCollectionRequest = z
  .object({
    id: Uuid,
    type: z.union([z.literal("standard"), z.literal("owned")]),
    name: z.string().min(1),
    schema: z.record(z.string(), z.unknown()),
  })
  .openapi({ ref: "CreateCollectionRequest" });

export type CreateCollectionRequest = z.infer<typeof CreateCollectionRequest>;

/**
 *
 */
export const CreateCollectionResponse = new Response(null, {
  status: StatusCodes.CREATED,
});

/**
 *
 */
export const DeleteCollectionRequestParams = z
  .object({
    id: Uuid,
  })
  .openapi({ ref: "DeleteCollectionRequestParams" });

/**
 *
 */
export type DeleteCollectionRequestParams = z.infer<
  typeof DeleteCollectionRequestParams
>;

/**
 *
 */
export const DeleteCollectionResponse = new Response(null, {
  status: StatusCodes.NO_CONTENT,
});

/**
 *
 */
export const ReadCollectionMetadataRequestParams = z
  .object({
    id: Uuid,
  })
  .openapi({ ref: "ReadCollectionMetadataRequestParams" });

/**
 *
 */
export type ReadCollectionMetadataRequestParams = z.infer<
  typeof ReadCollectionMetadataRequestParams
>;

/**
 *
 */
export const CollectionIndexDto = z.object({
  v: z.number(),
  key: z.record(z.string(), z.union([z.string(), z.number()])),
  name: z.string(),
  unique: z.boolean(),
});

/**
 *
 */
export const CollectionMetadataDto = z.object({
  id: z.string().uuid(),
  count: z.number(),
  size: z.number(),
  first_write: z.string().datetime(),
  last_write: z.string().datetime(),
  indexes: z.array(CollectionIndexDto),
});

/**
 *
 */
export const ReadCollectionMetadataResponse = ApiSuccessResponse(
  CollectionMetadataDto,
).openapi({ ref: "ReadCollectionMetadataResponse" });
export type ReadCollectionMetadataResponse = z.infer<
  typeof ReadCollectionMetadataResponse
>;
