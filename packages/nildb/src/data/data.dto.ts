import { ApiSuccessResponse } from "@nildb/common/handler";
import {
  PaginatedResponse,
  PaginationBodySchema,
} from "@nildb/common/pagination.dto";
import { AclDto } from "@nildb/users/users.dto";
import { z } from "zod";

/**
 * Owned data creation request.
 */
export const CreateOwnedDataRequest = z
  .object({
    owner: z.string(),
    collection: z.uuid(),
    data: z.array(z.record(z.string(), z.unknown())).min(1),
    acl: AclDto,
  })
  .meta({ ref: "CreateOwnedDataRequest" });
export type CreateOwnedDataRequest = z.infer<typeof CreateOwnedDataRequest>;

/**
 * Standard data creation request.
 */
export const CreateStandardDataRequest = z
  .object({
    collection: z.uuid(),
    data: z.array(z.record(z.string(), z.unknown())).min(1),
  })
  .meta({ ref: "CreateStandardDataRequest" });
export type CreateStandardDataRequest = z.infer<
  typeof CreateStandardDataRequest
>;

/**
 * Data creation response.
 */
export const CreateDataResponse = ApiSuccessResponse(
  z.object({
    created: z.array(z.uuid()),
    errors: z.array(
      z.object({
        error: z.string(),
        document: z.unknown(),
      }),
    ),
  }),
).meta({ ref: "CreateDataResponse" });
export type CreateDataResponse = z.infer<typeof CreateDataResponse>;

/**
 * Data update request.
 */
export const UpdateDataRequest = z
  .object({
    collection: z.uuid(),
    filter: z.record(z.string(), z.unknown()),
    update: z.record(z.string(), z.unknown()),
  })
  .meta({ ref: "UpdateDataRequest" });
export type UpdateDataRequest = z.infer<typeof UpdateDataRequest>;

/**
 * Data update response.
 */
export const UpdateDataResponse = ApiSuccessResponse(
  z.object({
    acknowledged: z.boolean(),
    matched: z.number().int().min(0),
    modified: z.number().int().min(0),
    upserted: z.number().int().min(0),
    upserted_id: z.string().nullable(),
  }),
).meta({ ref: "UpdateDataResponse" });
export type UpdateDataResponse = z.infer<typeof UpdateDataResponse>;

/**
 * Data find request.
 */
export const FindDataRequest = z
  .object({
    collection: z.uuid(),
    filter: z.record(z.string(), z.unknown()),
    ...PaginationBodySchema.shape,
  })
  .meta({ ref: "FindDataRequest" });
export type FindDataRequest = z.infer<typeof FindDataRequest>;

/**
 * Data find response.
 */
export const FindDataResponse = PaginatedResponse(
  z.record(z.string(), z.unknown()),
).meta({ ref: "FindDataResponse" });
export type FindDataResponse = z.infer<typeof FindDataResponse>;

/**
 * Data deletion request.
 */
export const DeleteDataRequest = z
  .object({
    collection: z.uuid(),
    filter: z
      .record(z.string(), z.unknown())
      .refine((obj) => Object.keys(obj).length > 0, "Filter cannot be empty"),
  })
  .meta({ ref: "DeleteDataRequest" });
export type DeleteDataRequest = z.infer<typeof DeleteDataRequest>;

/**
 * Data deletion response.
 */
export const DeleteDataResponse = ApiSuccessResponse(
  z.object({
    acknowledged: z.boolean(),
    deletedCount: z.number().int().min(0),
  }),
).meta({ ref: "DeleteDataResponse" });
export type DeleteDataResponse = z.infer<typeof DeleteDataResponse>;

/**
 * Data flush request.
 */
export const FlushDataRequest = z
  .object({
    collection: z.uuid(),
  })
  .meta({ ref: "FlushDataRequest" });
export type FlushDataRequest = z.infer<typeof FlushDataRequest>;

/**
 * Data flush response.
 */
export const FlushDataResponse = z.string();
export type FlushDataResponse = z.infer<typeof FlushDataResponse>;

/**
 * Data drop response.
 */
export const DropDataResponse = ApiSuccessResponse(
  z.object({
    acknowledged: z.boolean(),
    deletedCount: z.number().int().min(0),
  }),
).meta({ ref: "DropDataResponse" });
export type DropDataResponse = z.infer<typeof DropDataResponse>;

/**
 * Data collection ID parameters.
 */
export const DataSchemaByIdRequestParams = z
  .object({
    id: z.uuid(),
  })
  .meta({ ref: "DataSchemaByIdRequestParams" });
export type DataSchemaByIdRequestParams = z.infer<
  typeof DataSchemaByIdRequestParams
>;

/**
 * Data tail request parameters.
 */
export const TailDataRequestParams = z
  .object({
    id: z.uuid(),
  })
  .meta({ ref: "TailDataRequestParams" });
export type TailDataRequestParams = z.infer<typeof TailDataRequestParams>;

/**
 * Data tail query parameters.
 */
export const TailDataRequestQuery = z
  .object({
    limit: z.coerce.number().max(1_000).optional().default(25),
  })
  .meta({ ref: "TailDataRequestQuery" });
export type TailDataRequestQuery = z.infer<typeof TailDataRequestQuery>;

/**
 * Data tail response.
 */
export const TailDataResponse = ApiSuccessResponse(
  z.array(z.record(z.string(), z.unknown())),
).meta({ ref: "TailDataResponse" });
export type TailDataResponse = z.infer<typeof TailDataResponse>;
