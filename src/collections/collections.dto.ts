import { z } from "zod";
import { ApiSuccessResponse } from "#/common/handler";

/**
 * Collection document data.
 */
export const CollectionDocumentDto = z.object({
  id: z.string().uuid(),
  type: z.enum(["standard", "owned"]),
  name: z.string(),
});

/**
 * Collection documents array.
 */
export const CollectionDocuments = z.array(CollectionDocumentDto);

/**
 * Collections list response.
 */
export const ListCollectionsResponse = ApiSuccessResponse(
  CollectionDocuments,
).openapi({
  ref: "ListCollectionsResponse",
});
export type ListCollectionsResponse = z.infer<typeof ListCollectionsResponse>;

/**
 * Collection index creation request.
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

export type CreateCollectionIndexRequest = z.infer<
  typeof CreateCollectionIndexRequest
>;

/**
 * Drop collection index parameters.
 */
export const DropCollectionIndexParams = z.object({
  id: z.string().uuid(),
  name: z.string().min(4).max(50),
});

export type DropCollectionIndexParams = z.infer<
  typeof DropCollectionIndexParams
>;

/**
 * Drop collection index response.
 */
export const DropCollectionIndexResponse = z.string();
export type DropCollectionIndexResponse = z.infer<
  typeof DropCollectionIndexResponse
>;

/**
 * Collection creation request.
 */
export const CreateCollectionRequest = z
  .object({
    _id: z.string().uuid(),
    type: z.union([z.literal("standard"), z.literal("owned")]),
    name: z.string().min(1),
    schema: z.record(z.string(), z.unknown()),
  })
  .openapi({ ref: "CreateCollectionRequest" });

export type CreateCollectionRequest = z.infer<typeof CreateCollectionRequest>;

/**
 * Collection creation response.
 */
export const CreateCollectionResponse = z.string();
export type CreateCollectionResponse = z.infer<typeof CreateCollectionResponse>;

/**
 * Collection deletion parameters.
 */
export const DeleteCollectionRequestParams = z
  .object({
    id: z.string().uuid(),
  })
  .openapi({ ref: "DeleteCollectionRequestParams" });

export type DeleteCollectionRequestParams = z.infer<
  typeof DeleteCollectionRequestParams
>;

/**
 * Collection deletion response.
 */
export const DeleteCollectionResponse = z.string();
export type DeleteCollectionResponse = z.infer<typeof DeleteCollectionResponse>;

/**
 * Collection metadata read parameters.
 */
export const ReadCollectionMetadataRequestParams = z
  .object({
    id: z.string().uuid(),
  })
  .openapi({ ref: "ReadCollectionMetadataRequestParams" });

export type ReadCollectionMetadataRequestParams = z.infer<
  typeof ReadCollectionMetadataRequestParams
>;

/**
 * Collection creation index response.
 */
export const CreateCollectionIndexResponse = z.string();
export type CreateCollectionIndexResponse = z.infer<
  typeof CreateCollectionIndexResponse
>;

/**
 * Collection index data.
 */
export const CollectionIndexDto = z.object({
  v: z.number(),
  key: z.record(z.string(), z.union([z.string(), z.number()])),
  name: z.string(),
  unique: z.boolean(),
});

/**
 * Collection metadata data.
 */
export const CollectionMetadataDto = z.object({
  _id: z.string().uuid(),
  count: z.number(),
  size: z.number(),
  first_write: z.string().datetime(),
  last_write: z.string().datetime(),
  indexes: z.array(CollectionIndexDto),
});

/**
 * Collection metadata response.
 */
export const ReadCollectionMetadataResponse = ApiSuccessResponse(
  CollectionMetadataDto,
).openapi({ ref: "ReadCollectionMetadataResponse" });
export type ReadCollectionMetadataResponse = z.infer<
  typeof ReadCollectionMetadataResponse
>;
