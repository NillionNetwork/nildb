import { z } from "zod";

/**
 * Zod schema for common pagination query parameters.
 */
export const PaginationQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional().default(25),
  offset: z.coerce.number().int().min(0).optional().default(0),
});

export type PaginationQuery = z.infer<typeof PaginationQuerySchema>;

/**
 * Represents the structured result for a paginated query in the service layer.
 */
export type Paginated<T> = {
  data: T[];
  total: number;
  limit: number;
  offset: number;
};

/**
 * A generic factory for creating a paginated response schema.
 * @param dataSchema The Zod schema for the items in the data array.
 */
export const PaginatedResponse = <T extends z.ZodTypeAny>(dataSchema: T) =>
  z.object({
    data: z.array(dataSchema),
    pagination: z.object({
      total: z.number().int().min(0),
      limit: z.number().int().min(1),
      offset: z.number().int().min(0),
    }),
  });

/**
 * Zod schema for an optional pagination object in a request body.
 */
export const PaginationBodySchema = z.object({
  pagination: PaginationQuerySchema.optional(),
});

export type PaginationBody = z.infer<typeof PaginationBodySchema>;
