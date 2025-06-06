import { StatusCodes } from "http-status-codes";
import { z } from "zod";
import { ApiSuccessResponse } from "#/common/handler";
import { DidSchema } from "#/common/types";

/**
 * Request schema for registering a new organisation account.
 *
 * @example
 * {
 *   "did": "did:nil:037a87f9b010687e23eccb2fc70a474cbb612418cb513a62289eaed6cf1f11ac6b",
 *   "name": "My Organisation"
 * }
 */
export const RegisterAccountRequest = z
  .object({
    did: DidSchema,
    name: z.string().min(1).max(255),
  })
  .openapi({ ref: "RegisterAccountRequest" });
export type RegisterAccountRequest = z.infer<typeof RegisterAccountRequest>;

/**
 * Response for successful account registration.
 *
 * Returns HTTP 201 Created with empty body to indicate
 * the resource was created successfully.
 */
export const RegisterAccountResponse = new Response(null, {
  status: StatusCodes.CREATED,
});
export type RegisterAccountResponse = typeof RegisterAccountResponse;

/**
 * Profile schema for API responses.
 *
 * Represents an organisation's account data with dates
 * serialised as ISO strings for JSON compatibility.
 */
const Profile = z.object({
  _id: DidSchema,
  _created: z.string().datetime(),
  _updated: z.string().datetime(),
  name: z.string(),
  schemas: z.array(z.string().uuid()),
  queries: z.array(z.string().uuid()),
});

/**
 * Response schema for profile retrieval.
 *
 * Wraps the profile data in a standard success response
 * format with a `data` property.
 */
export const GetProfileResponse = ApiSuccessResponse(Profile).openapi({
  ref: "GetProfileResponse",
});
export type GetProfileResponse = z.infer<typeof GetProfileResponse>;

/**
 * Response for successful account deletion.
 *
 * Returns HTTP 204 No Content to indicate the resource
 * was deleted successfully with no response body.
 */
export const DeleteAccountResponse = new Response(null, {
  status: StatusCodes.NO_CONTENT,
});
export type DeleteAccountResponse = typeof DeleteAccountResponse;

/**
 * Request schema for updating account profile.
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
