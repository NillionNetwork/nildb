import { StatusCodes } from "http-status-codes";
import z from "zod";
import { ApiSuccessResponse } from "#/common/handler";
import { Did } from "#/common/types";

/**
 * Generic ID path parameter.
 */
export const ByIdRequestParams = z
  .object({
    id: z.string().uuid(),
  })
  .openapi({ ref: "ByIdRequestParams" });
export type ByIdRequestParams = z.infer<typeof ByIdRequestParams>;

/**
 * Access control list entry.
 */
export const AclDto = z.object({
  grantee: Did,
  read: z.boolean(),
  write: z.boolean(),
  execute: z.boolean(),
});
export type AclDto = z.infer<typeof AclDto>;

/**
 * User profile data.
 */
const UserProfileData = z.object({
  _id: Did,
  _created: z.string().datetime(),
  _updated: z.string().datetime(),
  log: z.array(
    z
      .object({
        col: z.string().uuid(),
        op: z.string(),
      })
      .passthrough(),
  ),
  data: z.array(
    z.object({
      collection: z.string().uuid(),
      id: z.string().uuid(),
    }),
  ),
});

/**
 * User profile response.
 */
export const ReadProfileResponse = ApiSuccessResponse(UserProfileData).openapi({
  ref: "ReadProfileResponse",
});
export type ReadProfileResponse = z.infer<typeof ReadProfileResponse>;

/**
 * Data read request parameters.
 */
export const ReadDataRequestParams = z
  .object({
    collection: z.string().uuid(),
    document: z.string().uuid(),
  })
  .openapi({
    ref: "ReadDataRequestParams",
  });

export type ReadDataRequestParams = z.infer<typeof ReadDataRequestParams>;

const OwnedDataDto = z
  .object({
    _id: z.string().uuid(),
    _created: z.string().datetime(),
    _updated: z.string().datetime(),
    _owner: Did,
    _acl: z.array(AclDto),
  })
  // Allow all keys through since each collection will follow a different schema
  .passthrough();

export const ReadDataResponse = ApiSuccessResponse(
  z.array(OwnedDataDto),
).openapi({
  ref: "ReadDataResponse",
});
export type ReadDataResponse = z.infer<typeof ReadDataResponse>;

/**
 * Data document reference.
 */
const DataDocumentReference = z.object({
  builder: Did,
  collection: z.string().uuid(),
  document: z.string().uuid(),
});

/**
 * User data references response.
 */
export const ListDataReferencesResponse = ApiSuccessResponse(
  z.array(DataDocumentReference),
).openapi({ ref: "ListDataReferencesResponse" });

export type ListDataReferencesResponse = z.infer<
  typeof ListDataReferencesResponse
>;

/**
 * Data ACL read parameters.
 */
export const ReadDataAclRequestParams = z
  .object({
    collection: z.string().uuid(),
    document: z.string().uuid(),
  })
  .openapi({ ref: "ReadDataAclRequestParams" });
export type ReadDataAclRequestParams = z.infer<typeof ReadDataAclRequestParams>;

/**
 * User data update request.
 */
export const UpdateUserDataRequest = z
  .object({
    document: z.string().uuid(),
    collection: z.string().uuid(),
    update: z.record(z.string(), z.unknown()),
  })
  .openapi({ ref: "UpdateUserDataRequest" });
export type UpdateUserDataRequest = z.infer<typeof UpdateUserDataRequest>;

/**
 * Data access response.
 */
export const ReadDataAccessResponse = ApiSuccessResponse(
  z.array(AclDto),
).openapi({
  ref: "ReadDataAccessResponse",
});
export type ReadDataAccessResponse = z.infer<typeof ReadDataAccessResponse>;

/**
 * Grant data access request.
 */
export const GrantAccessToDataRequest = z
  .object({
    collection: z.string().uuid(),
    document: z.string().uuid(),
    acl: AclDto,
  })
  .openapi({ ref: "GrantAccessToDataRequest" });
export type GrantAccessToDataRequest = z.infer<typeof GrantAccessToDataRequest>;

/**
 * Grant data access response.
 */
export const GrantAccessToDataResponse = new Response(null, {
  status: StatusCodes.NO_CONTENT,
});
export type GrantAccessToDataResponse = typeof GrantAccessToDataResponse;

/**
 * Revoke data access request.
 */
export const RevokeAccessToDataRequest = z
  .object({
    grantee: Did,
    collection: z.string().uuid(),
    document: z.string().uuid(),
  })
  .openapi({ ref: "RevokeAccessToDataRequest" });
export type RevokeAccessToDataRequest = z.infer<
  typeof RevokeAccessToDataRequest
>;

/**
 * Revoke data access response.
 */
export const RevokeAccessToDataResponse = new Response(null, {
  status: StatusCodes.NO_CONTENT,
});
export type RevokeAccessToDataResponse = typeof RevokeAccessToDataResponse;

/**
 * Document deletion parameters.
 */
export const DeleteDocumentRequestParams = z
  .object({
    collection: z.string().uuid(),
    document: z.string().uuid(),
  })
  .openapi({ ref: "DeleteDocumentRequestParams" });

export type DeleteDocumentRequestParams = z.infer<
  typeof DeleteDocumentRequestParams
>;

/**
 * Document deletion response.
 */
export const DeleteDocumentResponse = new Response(null, {
  status: StatusCodes.NO_CONTENT,
});
