import { z } from "zod";

import { BuilderStatusDto } from "./credits.dto";
import { PaginatedResponse } from "./pagination.dto";
import { ApiSuccessResponse } from "./responses.dto";

/**
 * Request to top up a builder's credits.
 */
export const AdminCreditTopUpRequest = z
  .object({
    builderDid: z.string().min(1),
    amountUsd: z.number().positive(),
    reason: z.string().max(500).optional(),
  })
  .meta({ ref: "AdminCreditTopUpRequest" });
export type AdminCreditTopUpRequest = z.infer<typeof AdminCreditTopUpRequest>;

/**
 * Response after topping up credits.
 */
const AdminCreditTopUpData = z.object({
  builderDid: z.string(),
  amountUsd: z.number(),
  newBalance: z.number(),
  status: BuilderStatusDto,
});
export const AdminCreditTopUpResponse = ApiSuccessResponse(AdminCreditTopUpData).meta({
  ref: "AdminCreditTopUpResponse",
});
export type AdminCreditTopUpResponse = z.infer<typeof AdminCreditTopUpResponse>;

/**
 * Builder list item for admin view.
 */
const AdminBuilderDto = z.object({
  did: z.string(),
  name: z.string(),
  creditsUsd: z.number().optional(),
  status: BuilderStatusDto.optional(),
  storageBytes: z.number().int().nonnegative(),
});

/**
 * Paginated list of builders for admin view.
 */
export const AdminListBuildersResponse = PaginatedResponse(AdminBuilderDto).meta({
  ref: "AdminListBuildersResponse",
});
export type AdminListBuildersResponse = z.infer<typeof AdminListBuildersResponse>;
