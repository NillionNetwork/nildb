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

/**
 * Request to update storage pricing.
 */
export const AdminUpdatePricingRequest = z
  .object({
    storageCostPerGbHour: z.number().positive(),
  })
  .meta({ ref: "AdminUpdatePricingRequest" });
export type AdminUpdatePricingRequest = z.infer<typeof AdminUpdatePricingRequest>;

/**
 * Response after updating storage pricing.
 */
const AdminUpdatePricingData = z.object({
  storageCostPerGbHour: z.number().positive(),
});
export const AdminUpdatePricingResponse = ApiSuccessResponse(AdminUpdatePricingData).meta({
  ref: "AdminUpdatePricingResponse",
});
export type AdminUpdatePricingResponse = z.infer<typeof AdminUpdatePricingResponse>;

/**
 * Request to migrate nilauth builders to the credit system.
 */
export const AdminMigrateBuildersRequest = z
  .object({
    creditsPerBuilder: z.number().positive().default(1000),
  })
  .meta({ ref: "AdminMigrateBuildersRequest" });
export type AdminMigrateBuildersRequest = z.infer<typeof AdminMigrateBuildersRequest>;

/**
 * Response after migrating builders.
 */
const AdminMigratedBuilderDto = z.object({
  did: z.string(),
  creditsGranted: z.number(),
});
const AdminMigrateBuildersData = z.object({
  migrated: z.number().int().nonnegative(),
  creditsPerBuilder: z.number(),
  builders: z.array(AdminMigratedBuilderDto),
});
export const AdminMigrateBuildersResponse = ApiSuccessResponse(AdminMigrateBuildersData).meta({
  ref: "AdminMigrateBuildersResponse",
});
export type AdminMigrateBuildersResponse = z.infer<typeof AdminMigrateBuildersResponse>;
