import { z } from "zod";
import { ApiSuccessResponse } from "#/common/handler";
import { Did } from "#/common/types";
import { AclDto } from "#/users/users.dto";

export const CreateOwnedDataRequest = z
  .object({
    owner: Did,
    schema: z.string().uuid(),
    data: z.array(z.record(z.string(), z.unknown())).min(1),
    acl: AclDto,
  })
  .openapi({ ref: "CreateOwnedDataRequest" });
export type CreateOwnedDataRequest = z.infer<typeof CreateOwnedDataRequest>;

export const CreateStandardDataRequest = z
  .object({
    schema: z.string().uuid(),
    data: z.array(z.record(z.string(), z.unknown())).min(1),
  })
  .openapi({ ref: "CreateStandardDataRequest" });
export type CreateStandardDataRequest = z.infer<
  typeof CreateStandardDataRequest
>;

export const CreateDataResponse = ApiSuccessResponse(
  z.object({
    created: z.array(z.string().uuid()),
    errors: z.array(
      z.object({
        error: z.string(),
        document: z.unknown(),
      }),
    ),
  }),
).openapi({ ref: "CreateDataResponse" });
export type CreateDataResponse = z.infer<typeof CreateDataResponse>;

export const UpdateDataRequest = z
  .object({
    schema: z.string().uuid(),
    filter: z.record(z.string(), z.unknown()),
    update: z.record(z.string(), z.unknown()),
  })
  .openapi({ ref: "UpdateDataRequest" });
export type UpdateDataRequest = z.infer<typeof UpdateDataRequest>;

export const UpdateDataResponse = ApiSuccessResponse(
  z.object({
    acknowledged: z.boolean(),
    matched: z.number().int().min(0),
    modified: z.number().int().min(0),
    upserted: z.number().int().min(0),
    upserted_id: z.string().nullable(),
  }),
).openapi({ ref: "UpdateDataResponse" });
export type UpdateDataResponse = z.infer<typeof UpdateDataResponse>;

export const FindDataRequest = z
  .object({
    schema: z.string().uuid(),
    filter: z.record(z.string(), z.unknown()),
  })
  .openapi({ ref: "FindDataRequest" });
export type FindDataRequest = z.infer<typeof FindDataRequest>;

export const FindDataResponse = ApiSuccessResponse(
  z.array(z.record(z.string(), z.unknown())),
).openapi({ ref: "FindDataResponse" });
export type FindDataResponse = z.infer<typeof FindDataResponse>;

export const DeleteDataRequest = z
  .object({
    schema: z.string().uuid(),
    filter: z.record(z.string(), z.unknown()),
  })
  .openapi({ ref: "DeleteDataRequest" });
export type DeleteDataRequest = z.infer<typeof DeleteDataRequest>;

export const DeleteDataResponse = ApiSuccessResponse(
  z.object({
    acknowledged: z.boolean(),
    deletedCount: z.number().int().min(0),
  }),
).openapi({ ref: "DeleteDataResponse" });
export type DeleteDataResponse = z.infer<typeof DeleteDataResponse>;

export const FlushDataRequest = z
  .object({
    schema: z.string().uuid(),
  })
  .openapi({ ref: "FlushDataRequest" });
export type FlushDataRequest = z.infer<typeof FlushDataRequest>;

export const DropDataResponse = ApiSuccessResponse(
  z.object({
    acknowledged: z.boolean(),
    deletedCount: z.number().int().min(0),
  }),
).openapi({ ref: "DropDataResponse" });
export type DropDataResponse = z.infer<typeof DropDataResponse>;

export const DataSchemaByIdRequestParams = z
  .object({
    id: z.string().uuid(),
  })
  .openapi({ ref: "DataSchemaByIdRequestParams" });
export type DataSchemaByIdRequestParams = z.infer<
  typeof DataSchemaByIdRequestParams
>;

export const TailDataRequestParams = z
  .object({
    id: z.string().uuid(),
  })
  .openapi({ ref: "TailDataRequestParams" });
export type TailDataRequestParams = z.infer<typeof TailDataRequestParams>;

export const TailDataRequestQuery = z
  .object({
    limit: z.number().max(1_000).optional().default(25),
  })
  .openapi({ ref: "TailDataRequestQuery" });
export type TailDataRequestQuery = z.infer<typeof TailDataRequestQuery>;

export const TailDataResponse = ApiSuccessResponse(
  z.array(z.record(z.string(), z.unknown())),
).openapi({ ref: "TailDataResponse" });
export type TailDataResponse = z.infer<typeof TailDataResponse>;
