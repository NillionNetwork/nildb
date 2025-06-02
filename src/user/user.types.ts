import { z } from "zod";
import { DidSchema } from "#/common/types";

/**
 *
 * Controller types
 */
export const UserDataRequestSchema = z.object({
  userId: DidSchema,
});
export type UserDataRequest = z.infer<typeof UserDataRequestSchema>;
