import type { DidString } from "@nillion/nuc";
import type { UUID } from "mongodb";
import type { JsonValue } from "type-fest";
import type { DocumentBase } from "#/common/mongo";

/**
 * Query variable configuration.
 */
export type QueryVariable = {
  path: string;
  description?: string;
  optional?: boolean;
};

/**
 * Query job status.
 */
export type QueryJobStatus = "pending" | "running" | "complete";

/**
 * Query document.
 */
export type QueryDocument = DocumentBase<UUID> & {
  owner: DidString;
  name: string;
  schema: UUID;
  variables: Record<string, QueryVariable>;
  pipeline: Record<string, unknown>[];
};

/**
 * Query job document.
 */
export type RunQueryJobDocument = DocumentBase<UUID> & {
  query: UUID;
  status: QueryJobStatus;
  started: Date;
  completed: Date;
  result: JsonValue;
  errors: string[];
};

/**
 * Query domain commands.
 */

/**
 * Add query command.
 */
export type AddQueryCommand = {
  _id: UUID;
  name: string;
  schema: UUID;
  variables: Record<string, QueryVariable>;
  pipeline: Record<string, unknown>[];
  owner: DidString;
};

/**
 * Run query command.
 */
export type RunQueryCommand = {
  id: UUID;
  variables: Record<string, unknown>;
};

/**
 * Delete query command.
 */
export type DeleteQueryCommand = {
  id: UUID;
};

/**
 * Get query run command.
 */
export type GetQueryRunByIdCommand = {
  id: UUID;
};
