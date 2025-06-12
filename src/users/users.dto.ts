import { StatusCodes } from "http-status-codes";
import z from "zod";
import { ApiSuccessResponse } from "#/common/handler";
import { Did } from "#/common/types";

/**
 * A generic id in path param schema.
 */
export const ByIdRequestParams = z
  .object({
    id: z.string().uuid(),
  })
  .openapi({ ref: "ByIdRequestParams" });
export type ByIdRequestParams = z.infer<typeof ByIdRequestParams>;

/**
 * Access control list for user-owned data.
 */
export const AclDto = z.object({
  grantee: Did,
  read: z.boolean(),
  write: z.boolean(),
  execute: z.boolean(),
});
export type AclDto = z.infer<typeof AclDto>;

/**
 * User profile data shape.
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
      // TODO: capture acl type
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
 * Response for getting user profile.
 */
export const ReadProfileResponse = ApiSuccessResponse(UserProfileData).openapi({
  ref: "ReadProfileResponse",
});
export type ReadProfileResponse = z.infer<typeof ReadProfileResponse>;

/**
 *
 */
export const ReadDataRequestParams = z
  .object({
    collection: z.string().uuid(),
    document: z.string().uuid(),
  })
  .openapi({
    ref: "ReadDataRequestParams",
  });

/**
 *
 */
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
 * Data document reference schema for user-owned data.
 */
const DataDocumentReference = z.object({
  builder: Did,
  collection: z.string().uuid(),
  document: z.string().uuid(),
});

/**
 * Response schema for getting user data.
 */
export const ListDataReferencesResponse = ApiSuccessResponse(
  z.array(DataDocumentReference),
).openapi({ ref: "ListDataReferencesResponse" });

/**
 *
 */
export type ListDataReferencesResponse = z.infer<
  typeof ListDataReferencesResponse
>;

/**
 * Request for reading permissions on a data document.
 */
export const ReadDataAclRequestParams = z
  .object({
    collection: z.string().uuid(),
    document: z.string().uuid(),
  })
  .openapi({ ref: "ReadDataAclRequestParams" });
export type ReadDataAclRequestParams = z.infer<typeof ReadDataAclRequestParams>;

/**
 * Response for reading data access.
 */
export const ReadDataAccessResponse = ApiSuccessResponse(
  z.array(AclDto),
).openapi({
  ref: "ReadDataAccessResponse",
});
export type ReadDataAccessResponse = z.infer<typeof ReadDataAccessResponse>;

/**
 *
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
 *
 */
export const GrantAccessToDataResponse = new Response(null, {
  status: StatusCodes.NO_CONTENT,
});
export type GrantAccessToDataResponse = typeof GrantAccessToDataResponse;

/**
 *
 */
export const RevokeAccessToDataRequest = z
  .object({
    builder: Did,
    collection: z.string().uuid(),
    document: z.string().uuid(),
  })
  .openapi({ ref: "RevokeAccessToDataRequest" });
export type RevokeAccessToDataRequest = z.infer<
  typeof RevokeAccessToDataRequest
>;

export const RevokeAccessToDataResponse = new Response(null, {
  status: StatusCodes.NO_CONTENT,
});
export type RevokeAccessToDataResponse = typeof RevokeAccessToDataResponse;

export const DeleteDocumentRequestParams = z
  .object({
    collection: z.string().uuid(),
    document: z.string().uuid(),
  })
  .openapi({ ref: "DeleteDocumentRequestParams" });

export type DeleteDocumentRequestParams = z.infer<
  typeof DeleteDocumentRequestParams
>;

export const DeleteDocumentResponse = new Response(null, {
  status: StatusCodes.NO_CONTENT,
});
