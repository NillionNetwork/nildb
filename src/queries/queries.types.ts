import type { DidString } from "@nillion/nuc";
import type { UUID } from "mongodb";
import type { JsonValue } from "type-fest";
import type { DocumentBase } from "#/common/mongo";

/**
 * Domain types for MongoDB aggregation query management and execution.
 *
 * These types define the structure for creating, storing, and executing
 * MongoDB aggregation queries with variable substitution and background
 * job processing capabilities.
 */

/**
 * Query variable configuration for MongoDB aggregation pipelines.
 *
 * Defines replaceable parameters within aggregation pipelines that can
 * be substituted with actual values during query execution.
 */
export type QueryVariable = {
  /** JSONPath expression for variable location in pipeline */
  path: string;
  /** Optional human-readable description of the variable's purpose */
  description?: string;
  /** Whether this variable is optional during execution */
  optional?: boolean;
};

/**
 * Query job execution status enumeration.
 *
 * Tracks the lifecycle of background query execution jobs:
 * - "pending": Job queued but not yet started
 * - "running": Job currently executing
 * - "complete": Job finished (successfully or with errors)
 */
export type QueryJobStatus = "pending" | "running" | "complete";

/**
 * Complete MongoDB aggregation query document.
 *
 * Represents a stored aggregation query with variable definitions
 * and pipeline stages for data processing and analysis.
 */
export type QueryDocument = DocumentBase<UUID> & {
  /** DID of the builder that owns this query */
  owner: DidString;
  /** Human-readable name for the query */
  name: string;
  /** UUID of the schema (collection) this query operates on */
  schema: UUID;
  /** Variable definitions for pipeline substitution */
  variables: Record<string, QueryVariable>;
  /** MongoDB aggregation pipeline stages */
  pipeline: Record<string, unknown>[];
};

/**
 * Run query background job document.
 *
 * Tracks the status and results of queries executed asynchronously,
 * providing progress monitoring and result retrieval capabilities.
 */
export type RunQueryJobDocument = DocumentBase<UUID> & {
  /** UUID of the query being executed */
  query: UUID;
  /** Current execution status */
  status: QueryJobStatus;
  /** Timestamp when execution began */
  started: Date;
  /** Timestamp when execution completed */
  completed: Date;
  /** Query results if execution completed successfully */
  result: JsonValue;
  /** Error messages if execution failed */
  errors: string[];
};

/**
 * Domain command types for query operations.
 *
 * These types represent business operations that can be performed
 * on queries, converted from DTOs at the boundary layer.
 */

/**
 * Command for adding a new query.
 *
 * Encapsulates the data needed to create a new MongoDB aggregation
 * query with variable definitions and pipeline stages.
 */
export type AddQueryCommand = {
  /** Unique identifier for the query */
  _id: UUID;
  /** Human-readable name for the query */
  name: string;
  /** UUID of the schema (collection) this query operates on */
  schema: UUID;
  /** Variable definitions for pipeline substitution */
  variables: Record<string, QueryVariable>;
  /** MongoDB aggregation pipeline stages */
  pipeline: Record<string, unknown>[];
  /** DID of the builder that owns this query */
  owner: DidString;
};

/**
 * Command for executing a query.
 *
 * Encapsulates the query execution request with variable values
 * and execution options.
 */
export type RunQueryCommand = {
  /** UUID of the query to execute */
  id: UUID;
  /** Variable values for pipeline substitution */
  variables: Record<string, unknown>;
};

/**
 * Command for deleting a query.
 */
export type DeleteQueryCommand = {
  /** UUID of the query to delete */
  id: UUID;
};

/**
 * Command for retrieving a query run by id.
 */
export type GetQueryRunByIdCommand = {
  /** UUID of the query job to retrieve */
  id: UUID;
};
