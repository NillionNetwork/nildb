import { z } from "zod";
import { DidSchema, Uuid, type UuidDto } from "#/common/types";

/**
 * Constants
 */
export const MAX_RECORDS_LENGTH = 10_000;

/**
 * Controller types
 */
export const UploadDataRequestSchema = z.object({
  userId: DidSchema,
  schema: Uuid,
  data: z
    .array(z.record(z.string(), z.unknown()))
    .refine(
      (elements) =>
        elements.length > 0 && elements.length <= MAX_RECORDS_LENGTH,
      { message: `Length must be non zero and lte ${MAX_RECORDS_LENGTH}` },
    ),
});
export type UploadDataRequest = z.infer<typeof UploadDataRequestSchema>;
export type PartialDataDocumentDto = UploadDataRequest["data"] & {
  _id: UuidDto;
};

export const UpdateDataRequestSchema = z.object({
  schema: Uuid,
  filter: z.record(z.string(), z.unknown()),
  update: z.record(z.string(), z.unknown()),
});
export type UpdateDataRequest = z.infer<typeof UpdateDataRequestSchema>;

export const ReadDataRequestSchema = z.object({
  schema: Uuid,
  filter: z.record(z.string(), z.unknown()),
});
export type ReadDataRequest = z.infer<typeof ReadDataRequestSchema>;

export const DeleteDataRequestSchema = z.object({
  schema: Uuid,
  filter: z
    .record(z.string(), z.unknown())
    .refine((obj) => Object.keys(obj).length > 0, {
      message: "Filter cannot be empty",
    }),
});
export type DeleteDataRequest = z.infer<typeof DeleteDataRequestSchema>;

export const FlushDataRequestSchema = z.object({
  schema: Uuid,
});
export type FlushDataRequest = z.infer<typeof FlushDataRequestSchema>;

export const TailDataRequestSchema = z.object({
  schema: Uuid,
});
export type TailDataRequest = z.infer<typeof TailDataRequestSchema>;
/**
 * Repository types
 */
