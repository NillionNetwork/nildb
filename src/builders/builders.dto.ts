import { StatusCodes } from "http-status-codes";
import { z } from "zod";
import { ApiSuccessResponse } from "#/common/handler";
import { Did } from "#/common/types";

/**
 * Request schema for registering a new builder.
 */
export const RegisterBuilderRequest = z
  .object({
    did: Did,
    name: z.string().min(1).max(255),
  })
  .openapi({ ref: "RegisterBuilderRequest" });
export type RegisterBuilderRequest = z.infer<typeof RegisterBuilderRequest>;

/**
 * Response for successful builder registration.
 */
export const RegisterBuilderResponse = new Response(null, {
  status: StatusCodes.CREATED,
});
export type RegisterBuilderResponse = typeof RegisterBuilderResponse;

/**
 * Builder profile dto.
 */
const ProfileDto = z.object({
  _id: Did,
  _created: z.string().datetime(),
  _updated: z.string().datetime(),
  name: z.string(),
  collections: z.array(z.string().uuid()),
  queries: z.array(z.string().uuid()),
});

/**
 * Response schema for profile retrieval.
 *
 * Wraps the profile data in a standard success response
 * format with a `data` property.
 */
export const ReadProfileResponse = ApiSuccessResponse(ProfileDto).openapi({
  ref: "GetProfileResponse",
});
export type ReadProfileResponse = z.infer<typeof ReadProfileResponse>;

/**
 * Response for successful builder deletion.
 *
 * Returns HTTP 204 No Content to indicate the resource
 * was deleted successfully with no response body.
 */
export const DeleteBuilderResponse = new Response(null, {
  status: StatusCodes.NO_CONTENT,
});
export type DeleteBuilderResponse = typeof DeleteBuilderResponse;

/**
 * Request schema for updating builder profile.
 *
 * All fields are optional - only provided fields will be updated.
 * At least one field must be provided.
 */
export const UpdateProfileRequest = z
  .object({
    name: z.string().min(1).max(255),
  })
  .openapi({ ref: "UpdateProfileRequest" });
export type UpdateProfileRequest = z.infer<typeof UpdateProfileRequest>;

/**
 * Response for profile update endpoint.
 *
 * Returns HTTP 204 No Content to indicate the profile update
 * was successful with no response body.
 */
export const UpdateProfileResponse = new Response(null, {
  status: StatusCodes.NO_CONTENT,
});
export type UpdateProfileResponse = typeof UpdateProfileResponse;
