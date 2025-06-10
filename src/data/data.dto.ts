import { z } from "zod";
import { ApiSuccessResponse } from "#/common/handler";
import { DidSchema, Uuid } from "#/common/types";
import { PermissionsDto } from "#/users/users.dto";

/**
 * Constants
 */
export const MAX_RECORDS_LENGTH = 10_000;

/**
 * Request schema for uploading owned data records.
 *
 * @example
 * {
 *   "userId": "did:nil:037a53808c8a27cef18e706301127d792664d73fa889b94c08eeb8dc9d6a01cb97",
 *   "schema": "123e4567-e89b-12d3-a456-426614174000",
 *   "data": [
 *     { "name": "Alice", "age": 30 },
 *     { "name": "Bob", "age": 25 }
 *   ]
 * }
 */
export const UploadOwnedDataRequest = z
  .object({
    userId: DidSchema,
    schema: Uuid,
    data: z
      .array(z.record(z.string(), z.unknown()))
      .refine(
        (elements) =>
          elements.length > 0 && elements.length <= MAX_RECORDS_LENGTH,
        { message: `Length must be non zero and lte ${MAX_RECORDS_LENGTH}` },
      ),
    permissions: PermissionsDto,
  })
  .openapi({ ref: "UploadOwnedDataRequest" });
export type UploadOwnedDataRequest = z.infer<typeof UploadOwnedDataRequest>;

/**
 * Request schema for uploading standard data records.
 *
 * @example
 * {
 *   "schema": "123e4567-e89b-12d3-a456-426614174000",
 *   "data": [
 *     { "name": "Alice", "age": 30 },
 *     { "name": "Bob", "age": 25 }
 *   ]
 * }
 */
export const UploadStandardDataRequest = z
  .object({
    schema: Uuid,
    data: z
      .array(z.record(z.string(), z.unknown()))
      .refine(
        (elements) =>
          elements.length > 0 && elements.length <= MAX_RECORDS_LENGTH,
        { message: `Length must be non zero and lte ${MAX_RECORDS_LENGTH}` },
      ),
  })
  .openapi({ ref: "UploadStandardDataRequest" });
export type UploadStandardDataRequest = z.infer<
  typeof UploadStandardDataRequest
>;

/**
 * Response for successful data upload.
 *
 * @example
 * {
 *   "data": {
 *     "created": 2,
 *     "errors": []
 *   }
 * }
 */
export const UploadDataResponse = ApiSuccessResponse(
  z.object({
    created: z.array(z.string().uuid()),
    errors: z.array(
      z.object({
        error: z.string(),
        document: z.unknown(),
      }),
    ),
  }),
).openapi({ ref: "UploadDataResponse" });
export type UploadDataResponse = z.infer<typeof UploadDataResponse>;

/**
 * Request schema for updating data records.
 *
 * @example
 * {
 *   "schema": "123e4567-e89b-12d3-a456-426614174000",
 *   "filter": { "name": "Alice" },
 *   "update": { "$set": { "age": 31 } }
 * }
 */
export const UpdateDataRequest = z
  .object({
    schema: Uuid,
    filter: z.record(z.string(), z.unknown()),
    update: z.record(z.string(), z.unknown()),
  })
  .openapi({ ref: "UpdateDataRequest" });
export type UpdateDataRequest = z.infer<typeof UpdateDataRequest>;

/**
 * Response for successful data update.
 *
 * @example
 * {
 *   "data": {
 *     "acknowledged": true,
 *     "matchedCount": 1,
 *     "modifiedCount": 1,
 *     "upsertedCount": 0,
 *     "upsertedId": null
 *   }
 * }
 */
export const UpdateDataResponse = ApiSuccessResponse(
  z.object({
    acknowledged: z.boolean(),
    matchedCount: z.number().int().min(0),
    modifiedCount: z.number().int().min(0),
    upsertedCount: z.number().int().min(0),
    upsertedId: z.string().nullable(),
  }),
).openapi({ ref: "UpdateDataResponse" });
export type UpdateDataResponse = z.infer<typeof UpdateDataResponse>;

/**
 * Request schema for reading data records.
 *
 * @example
 * {
 *   "schema": "123e4567-e89b-12d3-a456-426614174000",
 *   "filter": { "age": { "$gte": 25 } }
 * }
 */
export const ReadDataRequest = z
  .object({
    schema: Uuid,
    filter: z.record(z.string(), z.unknown()),
  })
  .openapi({ ref: "ReadDataRequest" });
export type ReadDataRequest = z.infer<typeof ReadDataRequest>;

/**
 * Response for successful data read.
 *
 * @example
 * {
 *   "data": [
 *     {
 *       "_id": "123e4567-e89b-12d3-a456-426614174001",
 *       "_created": "2023-12-01T10:00:00.000Z",
 *       "_updated": "2023-12-01T10:00:00.000Z",
 *       "_owner": "did:nil:...",
 *       "name": "Alice",
 *       "age": 30
 *     }
 *   ]
 * }
 */
export const ReadDataResponse = ApiSuccessResponse(
  z.array(
    z
      .object({
        _id: z.string().uuid(),
        _created: z.string().datetime(),
        _updated: z.string().datetime(),
        _owner: z.string().optional(),
      })
      .passthrough(),
  ),
).openapi({ ref: "ReadDataResponse" });
export type ReadDataResponse = z.infer<typeof ReadDataResponse>;

/**
 * Request schema for deleting data records.
 *
 * @example
 * {
 *   "schema": "123e4567-e89b-12d3-a456-426614174000",
 *   "filter": { "name": "Alice" }
 * }
 */
export const DeleteDataRequest = z
  .object({
    schema: Uuid,
    filter: z
      .record(z.string(), z.unknown())
      .refine((obj) => Object.keys(obj).length > 0, {
        message: "Filter cannot be empty",
      }),
  })
  .openapi({ ref: "DeleteDataRequest" });
export type DeleteDataRequest = z.infer<typeof DeleteDataRequest>;

/**
 * Response for successful data deletion.
 *
 * @example
 * {
 *   "data": {
 *     "acknowledged": true,
 *     "deletedCount": 1
 *   }
 * }
 */
export const DeleteDataResponse = ApiSuccessResponse(
  z.object({
    acknowledged: z.boolean(),
    deletedCount: z.number().int().min(0),
  }),
).openapi({ ref: "DeleteDataResponse" });
export type DeleteDataResponse = z.infer<typeof DeleteDataResponse>;

/**
 * Request schema for flushing all data from a schema collection.
 *
 * @example
 * {
 *   "schema": "123e4567-e89b-12d3-a456-426614174000"
 * }
 */
export const FlushDataRequest = z
  .object({
    schema: Uuid,
  })
  .openapi({ ref: "FlushDataRequest" });
export type FlushDataRequest = z.infer<typeof FlushDataRequest>;

/**
 * Response for successful data flush.
 *
 * @example
 * {
 *   "data": {
 *     "acknowledged": true,
 *     "deletedCount": 42
 *   }
 * }
 */
export const FlushDataResponse = ApiSuccessResponse(
  z.object({
    acknowledged: z.boolean(),
    deletedCount: z.number().int().min(0),
  }),
).openapi({ ref: "FlushDataResponse" });
export type FlushDataResponse = z.infer<typeof FlushDataResponse>;

/**
 * Request schema for tailing recent data from a schema collection.
 *
 * @example
 * {
 *   "schema": "123e4567-e89b-12d3-a456-426614174000"
 * }
 */
export const TailDataRequest = z
  .object({
    schema: Uuid,
  })
  .openapi({ ref: "TailDataRequest" });
export type TailDataRequest = z.infer<typeof TailDataRequest>;

/**
 * Response for successful data tail.
 * Returns the most recent records from the collection.
 *
 * @example
 * {
 *   "data": [
 *     {
 *       "_id": "123e4567-e89b-12d3-a456-426614174001",
 *       "_created": "2023-12-01T10:00:00.000Z",
 *       "_updated": "2023-12-01T10:00:00.000Z",
 *       "_owner": "did:nil:...",
 *       "name": "Alice",
 *       "age": 30
 *     }
 *   ]
 * }
 */
export const TailDataResponse = ApiSuccessResponse(
  z.array(
    z
      .object({
        _id: z.string().uuid(),
        _created: z.string().datetime(),
        _updated: z.string().datetime(),
        _owner: z.string().optional(),
      })
      .passthrough(),
  ),
).openapi({ ref: "TailDataResponse" });
export type TailDataResponse = z.infer<typeof TailDataResponse>;
