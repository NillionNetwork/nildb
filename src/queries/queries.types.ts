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
const VariablePrimitiveSchema = z.enum(["string", "number", "boolean", "date"]);
export const QueryVariableValidatorSchema = z.union([
  z.object({
    type: VariablePrimitiveSchema,
    path: VariablePathSchema,
    description: z.string().optional(),
  }),
  z.object({
    type: z.enum(["array"]),
    path: VariablePathSchema,
    description: z.string().optional(),
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
});
export type ExecuteQueryRequest = z.infer<typeof ExecuteQueryRequestSchema>;

/**
 * Repository types
 */
export type QueryVariable = {
  type: "string" | "number" | "boolean" | "date";
  path: string;
  description?: string;
  optional?: boolean;
};

export type QueryArrayVariable = {
  type: "array";
  path: string;
  description?: string;
  items: {
    type: "string" | "number" | "boolean" | "date";
  };
  optional?: boolean;
};

export type QueryDocument = DocumentBase & {
  owner: DidString;
  name: string;
  // the query's starting collection
  schema: UUID;
  variables: Record<string, QueryVariable | QueryArrayVariable>;
  pipeline: Record<string, unknown>[];
};
