import type { IndexDirection, UUID } from "mongodb";
import { z } from "zod";
import { Uuid } from "#/common/types";
/**
 *
 * Controller types
 */
export const AddSchemaRequestSchema = z.object({
  _id: Uuid,
  name: z.string().min(1),
  schema: z.record(z.string(), z.unknown()),
  documentType: z.union([z.literal("standard"), z.literal("owned")]),
});
export type AddSchemaRequest = z.infer<typeof AddSchemaRequestSchema>;

export const DeleteSchemaRequestSchema = z.object({
  id: Uuid,
});
export type DeleteSchemaRequest = z.infer<typeof DeleteSchemaRequestSchema>;

/**
 * Repository types
 */
export type SchemaMetadata = {
  id: UUID;
  count: number;
  size: number;
  firstWrite: Date;
  lastWrite: Date;
  indexes: CollectionIndex[];
};

export type CollectionIndex = {
  v: number;
  key: Record<string, IndexDirection>;
  name: string;
  unique: boolean;
};
