import { StatusCodes } from "http-status-codes";
import { z } from "zod";
import { ApiSuccessResponse } from "#/common/handler";
import { Did } from "#/common/types";

/**
 * Builder registration request.
 */
export const RegisterBuilderRequest = z
  .object({
    did: Did,
    name: z.string().min(1).max(255),
  })
  .openapi({ ref: "RegisterBuilderRequest" });
export type RegisterBuilderRequest = z.infer<typeof RegisterBuilderRequest>;

/**
 * Builder registration response.
 */
export const RegisterBuilderResponse = new Response(null, {
  status: StatusCodes.CREATED,
});
export type RegisterBuilderResponse = typeof RegisterBuilderResponse;

/**
 * Builder profile data.
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
 * Profile retrieval response.
 */
export const ReadProfileResponse = ApiSuccessResponse(ProfileDto).openapi({
  ref: "GetProfileResponse",
});
export type ReadProfileResponse = z.infer<typeof ReadProfileResponse>;

/**
 * Builder deletion response.
 */
export const DeleteBuilderResponse = new Response(null, {
  status: StatusCodes.NO_CONTENT,
});
export type DeleteBuilderResponse = typeof DeleteBuilderResponse;

/**
 * Profile update request.
 */
export const UpdateProfileRequest = z
  .object({
    name: z.string().min(1).max(255),
  })
  .openapi({ ref: "UpdateProfileRequest" });
export type UpdateProfileRequest = z.infer<typeof UpdateProfileRequest>;

/**
 * Profile update response.
 */
export const UpdateProfileResponse = new Response(null, {
  status: StatusCodes.NO_CONTENT,
});
export type UpdateProfileResponse = typeof UpdateProfileResponse;
