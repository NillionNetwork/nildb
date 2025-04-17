import type { DidString } from "@nillion/nuc";
import type { UUID } from "mongodb";
import { z } from "zod";
import type { DocumentBase } from "#/common/mongo";
import { Uuid } from "#/common/types";

const PATH_EXPRESSION = /^\$(\.[$a-zA-Z][a-zA-Z0-9-_]+(\[\d+])*)+$/;
const VariablePathSchema = z
  .string()
  .transform((path) => PATH_EXPRESSION.exec(path))
  .refine((match) => match !== null, "invalid PATH")
  .transform((match) => match[0]);

/**
 * Controller types
 */
export const QueryVariableValidatorSchema = z.object({
  path: VariablePathSchema,
  description: z.string().optional(),
});

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
});
export type ExecuteQueryRequest = z.infer<typeof ExecuteQueryRequestSchema>;

export const QueryJobStatusSchema = z.enum(["pending", "running", "complete"]);
export type QueryJobStatus = z.infer<typeof QueryJobStatusSchema>;

/**
 * Repository types
 */
export type QueryVariable = {
  path: string;
  description?: string;
  optional?: boolean;
};

export type QueryDocument = DocumentBase & {
  owner: DidString;
  name: string;
  // the query's starting collection
  schema: UUID;
  variables: Record<string, QueryVariable>;
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
