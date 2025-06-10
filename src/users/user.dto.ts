import z from "zod";
import { ApiSuccessResponse } from "#/common/handler";
import { DidSchema } from "#/common/types";

/**
 * Permission for user-owned data.
 *
 * Defines read, write, and execute permissions for a specific DID
 * on data documents.
 */
export const PermissionsDto = z.object({
  did: DidSchema,
  perms: z.object({
    read: z.boolean(),
    write: z.boolean(),
    execute: z.boolean(),
  }),
});
export type PermissionsDto = z.infer<typeof PermissionsDto>;

/**
 * Request schema for listing user data references.
 *
 * @example
 * {
 *   "userId": "did:nil:037a87f9b010687e23eccb2fc70a474cbb612418cb513a62289eaed6cf1f11ac6b"
 * }
 */
export const UserDataRequest = z
  .object({
    userId: DidSchema,
  })
  .openapi({ ref: "UserDataRequest" });
export type UserDataRequest = z.infer<typeof UserDataRequest>;

/**
 * Data document reference schema for user-owned data.
 *
 * Links a user to their data documents across different schemas.
 */
const DataDocumentReference = z.object({
  _id: z.string().uuid(),
  _created: z.string().datetime(),
  _updated: z.string().datetime(),
  _owner: z.string().optional(),
});

/**
 * Response schema for listing user data.
 *
 * @example
 * {
 *   "data": [
 *     {
 *       "_id": "123e4567-e89b-12d3-a456-426614174000",
 *       "_created": "2023-12-01T10:00:00.000Z",
 *       "_updated": "2023-12-01T10:00:00.000Z",
 *       "_owner": "did:nil:037a87f9b010687e23eccb2fc70a474cbb612418cb513a62289eaed6cf1f11ac6b"
 *     }
 *   ]
 * }
 */
export const ListUserDataResponse = ApiSuccessResponse(
  z.array(DataDocumentReference.passthrough()),
).openapi({ ref: "ListUserDataResponse" });
export type ListUserDataResponse = z.infer<typeof ListUserDataResponse>;

/**
 * Request schema for reading permissions on a data document.
 *
 * @example
 * {
 *   "schema": "456e7890-e89b-12d3-a456-426614174001",
 *   "documentId": "123e4567-e89b-12d3-a456-426614174000"
 * }
 */
export const ReadPermissionsRequest = z
  .object({
    schema: z.string().uuid(),
    documentId: z.string().uuid(),
  })
  .openapi({ ref: "ReadPermissionsRequest" });
export type ReadPermissionsRequest = z.infer<typeof ReadPermissionsRequest>;

/**
 * Response schema for reading document permissions.
 *
 * @example
 * {
 *   "data": [
 *     {
 *       "did": "did:nil:037a87f9b010687e23eccb2fc70a474cbb612418cb513a62289eaed6cf1f11ac6b",
 *       "perms": {
 *         "read": true,
 *         "write": false,
 *         "execute": false
 *       }
 *     }
 *   ]
 * }
 */
export const ReadPermissionsResponse = ApiSuccessResponse(
  z.array(PermissionsDto),
).openapi({
  ref: "ReadPermissionsResponse",
});
export type ReadPermissionsResponse = z.infer<typeof ReadPermissionsResponse>;

/**
 * Request schema for adding permissions to a data document.
 *
 * @example
 * {
 *   "schema": "456e7890-e89b-12d3-a456-426614174001",
 *   "documentId": "123e4567-e89b-12d3-a456-426614174000",
 *   "permissions": {
 *     "did": "did:nil:037a87f9b010687e23eccb2fc70a474cbb612418cb513a62289eaed6cf1f11ac6b",
 *     "perms": {
 *       "read": true,
 *       "write": true,
 *       "execute": false
 *     }
 *   }
 * }
 */
export const AddPermissionsRequest = z
  .object({
    schema: z.string().uuid(),
    documentId: z.string().uuid(),
    permissions: PermissionsDto,
  })
  .openapi({ ref: "AddPermissionsRequest" });
export type AddPermissionsRequest = z.infer<typeof AddPermissionsRequest>;

/**
 * Response for successful permission addition.
 *
 * Returns HTTP 200 OK with update result information.
 */
export const AddPermissionsResponse = ApiSuccessResponse(
  z.object({
    upserted_id: z.string().uuid().nullable(),
    acknowledged: z.boolean(),
    matched_count: z.number(),
    modified_count: z.number(),
    upserted_count: z.number(),
  }),
).openapi({ ref: "AddPermissionsResponse" });
export type AddPermissionsResponse = z.infer<typeof AddPermissionsResponse>;

/**
 * Request schema for updating permissions on a data document.
 *
 * @example
 * {
 *   "schema": "456e7890-e89b-12d3-a456-426614174001",
 *   "documentId": "123e4567-e89b-12d3-a456-426614174000",
 *   "permissions": {
 *     "did": "did:nil:037a87f9b010687e23eccb2fc70a474cbb612418cb513a62289eaed6cf1f11ac6b",
 *     "perms": {
 *       "read": true,
 *       "write": false,
 *       "execute": true
 *     }
 *   }
 * }
 */
export const UpdatePermissionsRequest = z
  .object({
    schema: z.string().uuid(),
    documentId: z.string().uuid(),
    permissions: PermissionsDto,
  })
  .openapi({ ref: "UpdatePermissionsRequest" });
export type UpdatePermissionsRequest = z.infer<typeof UpdatePermissionsRequest>;

/**
 * Response schema for permission update operations.
 *
 * @example
 * {
 *   "data": {
 *     "upserted_id": null,
 *     "acknowledged": true,
 *     "matched_count": 1,
 *     "modified_count": 1,
 *     "upserted_count": 0
 *   }
 * }
 */
export const UpdatePermissionsResponse = ApiSuccessResponse(
  z.object({
    upserted_id: z.string().uuid().nullable(),
    acknowledged: z.boolean(),
    matched_count: z.number(),
    modified_count: z.number(),
    upserted_count: z.number(),
  }),
).openapi({
  ref: "UpdatePermissionsResponse",
});
export type UpdatePermissionsResponse = z.infer<
  typeof UpdatePermissionsResponse
>;

/**
 * Request schema for deleting permissions from a data document.
 *
 * @example
 * {
 *   "schema": "456e7890-e89b-12d3-a456-426614174001",
 *   "documentId": "123e4567-e89b-12d3-a456-426614174000",
 *   "did": "did:nil:037a87f9b010687e23eccb2fc70a474cbb612418cb513a62289eaed6cf1f11ac6b"
 * }
 */
export const DeletePermissionsRequest = z
  .object({
    schema: z.string().uuid(),
    documentId: z.string().uuid(),
    did: DidSchema,
  })
  .openapi({ ref: "DeletePermissionsRequest" });
export type DeletePermissionsRequest = z.infer<typeof DeletePermissionsRequest>;

/**
 * Response schema for permission deletion operations.
 *
 * @example
 * {
 *   "data": {
 *     "upserted_id": null,
 *     "acknowledged": true,
 *     "matched_count": 1,
 *     "modified_count": 1,
 *     "upserted_count": 0
 *   }
 * }
 */
export const DeletePermissionsResponse = ApiSuccessResponse(
  z.object({
    upserted_id: z.string().uuid().nullable(),
    acknowledged: z.boolean(),
    matched_count: z.number(),
    modified_count: z.number(),
    upserted_count: z.number(),
  }),
).openapi({
  ref: "DeletePermissionsResponse",
});
export type DeletePermissionsResponse = z.infer<
  typeof DeletePermissionsResponse
>;
