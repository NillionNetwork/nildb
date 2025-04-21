import type { DidString } from "@nillion/nuc";
import type { UUID } from "mongodb";
import type { JsonValue } from "type-fest";
import { z } from "zod";
import type { DocumentBase } from "#/common/mongo";
import { Uuid } from "#/common/types";

/**
 * Controller types
 */
const VariablePrimitiveSchema = z.enum(["string", "number", "boolean", "date"]);
export const QueryVariableValidatorSchema = z.union([
  z.object({
    type: VariablePrimitiveSchema,
    description: z.string(),
  }),
  z.object({
    type: z.enum(["array"]),
    description: z.string(),
    items: z.object({
      type: VariablePrimitiveSchema,
    }),
  }),
]);

export const AddQueryRequestSchema = z.object({
  _id: Uuid,
  name: z.string(),
  schema: Uuid,
  variables: z.record(z.string(), QueryVariableValidatorSchema),
  pipeline: z.array(z.record(z.string(), z.unknown())),
});
export type AddQueryRequest = z.infer<typeof AddQueryRequestSchema>;

export const DeleteQueryRequestSchema = z.object({
  id: Uuid,
});
export type DeleteQueryRequest = z.infer<typeof DeleteQueryRequestSchema>;

export const ExecuteQueryRequestSchema = z.object({
  id: Uuid,
  variables: z.record(z.string(), z.unknown()),
  background: z.boolean().optional(),
});
export type ExecuteQueryRequest = z.infer<typeof ExecuteQueryRequestSchema>;

export const QueryJobRequestSchema = z.object({
  id: Uuid,
});
export type QueryJobRequest = z.infer<typeof QueryJobRequestSchema>;

export const QueryJobStatusSchema = z.enum(["pending", "running", "complete"]);
export type QueryJobStatus = z.infer<typeof QueryJobStatusSchema>;

/**
 * Repository types
 */
export type QueryVariable = {
  type: "string" | "number" | "boolean" | "date";
  description: string;
};

export type QueryArrayVariable = {
  type: "array";
  description: string;
  items: {
    type: "string" | "number" | "boolean" | "date";
  };
};

export type QueryDocument = DocumentBase & {
  owner: DidString;
  name: string;
  // the query's starting collection
  schema: UUID;
  variables: Record<string, QueryVariable | QueryArrayVariable>;
  pipeline: Record<string, unknown>[];
};

export type QueryJobDocument = DocumentBase & {
  queryId: UUID;
  status: QueryJobStatus;
  startedAt?: Date;
  endedAt?: Date;
  result?: JsonValue;
  errors?: string[];
};
