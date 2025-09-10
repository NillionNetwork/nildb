import z from "zod";
import { ApiSuccessResponse } from "#/common/handler";

/**
 * Generic ID path parameter.
 */
export const ByIdRequestParams = z
  .object({
    id: z.uuid(),
  })
  .meta({ ref: "ByIdRequestParams" });
export type ByIdRequestParams = z.infer<typeof ByIdRequestParams>;

/**
 * Access control list entry.
 */
export const AclDto = z.object({
  grantee: z.string(),
  read: z.boolean(),
  write: z.boolean(),
  execute: z.boolean(),
});
export type AclDto = z.infer<typeof AclDto>;

/**
 * User operation log entry.
 */
const UserDataLogs = z.discriminatedUnion("op", [
  z.object({ op: z.literal("create-data"), collection: z.uuid() }),
  z.object({ op: z.literal("update-data"), collection: z.uuid() }),
  z.object({ op: z.literal("delete-data"), collection: z.uuid() }),
  z.object({
    op: z.literal("grant-access"),
    collection: z.uuid(),
    acl: AclDto,
  }),
  z.object({
    op: z.literal("revoke-access"),
    collection: z.uuid(),
    grantee: z.string(),
  }),
]);
export type UserDataLogs = z.infer<typeof UserDataLogs>;

/**
 * User profile data.
 */
const UserProfileData = z.object({
  _id: z.string(),
  _created: z.string().datetime(),
  _updated: z.string().datetime(),
  logs: z.array(UserDataLogs),
  data: z.array(
    z.object({
      collection: z.uuid(),
      id: z.uuid(),
    }),
  ),
});

/**
 * User profile response.
 */
export const ReadProfileResponse = ApiSuccessResponse(UserProfileData).meta({
  ref: "ReadProfileResponse",
});
export type ReadProfileResponse = z.infer<typeof ReadProfileResponse>;

/**
 * Data read request parameters.
 */
export const ReadDataRequestParams = z
  .object({
    collection: z.uuid(),
    document: z.uuid(),
  })
  .meta({
    ref: "ReadDataRequestParams",
  });

export type ReadDataRequestParams = z.infer<typeof ReadDataRequestParams>;

const OwnedDataDto = z
  .object({
    _id: z.uuid(),
    _created: z.string().datetime(),
    _updated: z.string().datetime(),
    _owner: z.string(),
    _acl: z.array(AclDto),
  })
  // Allow all keys through since each collection will follow a different schema
  .passthrough();

export const ReadDataResponse = ApiSuccessResponse(OwnedDataDto).meta({
  ref: "ReadDataResponse",
});
export type ReadDataResponse = z.infer<typeof ReadDataResponse>;

/**
 * Data document reference.
 */
const DataDocumentReference = z.object({
  builder: z.string(),
  collection: z.uuid(),
  document: z.uuid(),
});

/**
 * User data references response.
 */
export const ListDataReferencesResponse = ApiSuccessResponse(
  z.array(DataDocumentReference),
).meta({ ref: "ListDataReferencesResponse" });

export type ListDataReferencesResponse = z.infer<
  typeof ListDataReferencesResponse
>;

/**
 * Data ACL read parameters.
 */
export const ReadDataAclRequestParams = z
  .object({
    collection: z.uuid(),
    document: z.uuid(),
  })
  .meta({ ref: "ReadDataAclRequestParams" });
export type ReadDataAclRequestParams = z.infer<typeof ReadDataAclRequestParams>;

/**
 * User data update request.
 */
export const UpdateUserDataRequest = z
  .object({
    document: z.uuid(),
    collection: z.uuid(),
    update: z.record(z.string(), z.unknown()),
  })
  .meta({ ref: "UpdateUserDataRequest" });
export type UpdateUserDataRequest = z.infer<typeof UpdateUserDataRequest>;

/**
 * Data access response.
 */
export const ReadDataAccessResponse = ApiSuccessResponse(z.array(AclDto)).meta({
  ref: "ReadDataAccessResponse",
});
export type ReadDataAccessResponse = z.infer<typeof ReadDataAccessResponse>;

/**
 * Grant data access request.
 */
export const GrantAccessToDataRequest = z
  .object({
    collection: z.uuid(),
    document: z.uuid(),
    acl: AclDto,
  })
  .meta({ ref: "GrantAccessToDataRequest" });
export type GrantAccessToDataRequest = z.infer<typeof GrantAccessToDataRequest>;

/**
 * Grant data access response.
 */
export const GrantAccessToDataResponse = z.string();
export type GrantAccessToDataResponse = z.infer<
  typeof GrantAccessToDataResponse
>;

/**
 * Revoke data access request.
 */
export const RevokeAccessToDataRequest = z
  .object({
    grantee: z.string(),
    collection: z.uuid(),
    document: z.uuid(),
  })
  .meta({ ref: "RevokeAccessToDataRequest" });
export type RevokeAccessToDataRequest = z.infer<
  typeof RevokeAccessToDataRequest
>;

/**
 * Revoke data access response.
 */
export const RevokeAccessToDataResponse = z.string();
export type RevokeAccessToDataResponse = z.infer<
  typeof RevokeAccessToDataResponse
>;

/**
 * Document deletion parameters.
 */
export const DeleteDocumentRequestParams = z
  .object({
    collection: z.uuid(),
    document: z.uuid(),
  })
  .meta({ ref: "DeleteDocumentRequestParams" });

export type DeleteDocumentRequestParams = z.infer<
  typeof DeleteDocumentRequestParams
>;

/**
 * Document deletion response.
 */
export const DeleteDocumentResponse = z.string();
export type DeleteDocumentResponse = z.infer<typeof DeleteDocumentResponse>;
