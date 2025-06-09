import type { IndexDirection, UUID } from "mongodb";
import type { DocumentBase } from "#/common/mongo";
import type { Did } from "#/common/types";

/**
 * Domain types for JSON schema management and data validation.
 *
 * These types define the structure for JSON schema definitions that
 * validate data uploads, manage collection metadata, and control
 * data access patterns within the NilDB system.
 */

/**
 * Schema document type enumeration.
 *
 * Defines the access control model for data stored under a schema:
 * - "standard": Builder is the data owner
 * - "owned": Data access is restricted to the data owner
 */
export type SchemaDocumentType = "standard" | "owned";

/**
 * Base schema document structure.
 *
 * Provides common fields for all schema documents including
 * timestamps and unique identifier.
 */
export type SchemaDocumentBase = DocumentBase<UUID>;

/**
 * Complete schema document structure.
 *
 * Represents a JSON schema definition stored in the database,
 * including ownership information, validation rules, and access control.
 */
export type SchemaDocument = SchemaDocumentBase & {
  /** DID of the builder that owns this schema */
  owner: Did;
  /** Human-readable name for the schema */
  name: string;
  /** JSON Schema definition for data validation */
  schema: Record<string, unknown>;
  /** Access control type for data stored under this schema */
  documentType: SchemaDocumentType;
};

/**
 * Schema collection metadata and statistics.
 *
 * Provides information about a schema's associated MongoDB collection
 * including document counts, storage usage, and index configuration.
 */
export type SchemaMetadata = {
  /** Unique identifier of the schema */
  id: UUID;
  /** Number of documents in the collection */
  count: number;
  /** Storage size in bytes */
  size: number;
  /** Timestamp of the first data write */
  firstWrite: Date;
  /** Timestamp of the most recent data write */
  lastWrite: Date;
  /** MongoDB indexes configured for the collection */
  indexes: CollectionIndex[];
};

/**
 * MongoDB collection index information.
 *
 * Represents the structure and configuration of a MongoDB index
 * including field mappings, constraints, and performance settings.
 */
export type CollectionIndex = {
  /** Index version number */
  v: number;
  /** Field-to-direction mapping for index keys */
  key: Record<string, IndexDirection>;
  /** Index name for identification */
  name: string;
  /** Whether the index enforces uniqueness */
  unique: boolean;
};

/**
 * Domain command types for schema operations.
 *
 * These types represent business operations that can be performed
 * on schemas, converted from DTOs at the boundary layer.
 */

/**
 * Command for adding a new schema.
 *
 * Encapsulates the data needed to create a new JSON schema
 * definition in the system.
 */
export type AddSchemaCommand = {
  /** Unique identifier for the schema */
  _id: UUID;
  /** Human-readable name for the schema */
  name: string;
  /** JSON Schema definition for data validation */
  schema: Record<string, unknown>;
  /** Access control type for data stored under this schema */
  documentType: SchemaDocumentType;
  /** DID of the builder that owns this schema */
  owner: Did;
};

/**
 * Command for deleting a schema.
 *
 * Encapsulates the identifier of the schema to be removed.
 */
export type DeleteSchemaCommand = {
  /** Unique identifier of the schema to delete */
  id: UUID;
};

/**
 * Command for creating an index on a schema collection.
 *
 * Encapsulates the index configuration for a MongoDB collection.
 */
export type CreateIndexCommand = {
  /** Schema identifier for the collection */
  schema: UUID;
  /** Index name for identification */
  name: string;
  /** Field-to-direction mapping for index keys */
  keys: Record<string, IndexDirection>;
  /** Whether the index enforces uniqueness */
  unique: boolean;
  /** Time-to-live in seconds (optional) */
  ttl?: number;
};

/**
 * Command for dropping an index from a schema collection.
 *
 * Encapsulates the schema and index name to remove.
 */
export type DropIndexCommand = {
  /** Schema identifier for the collection */
  schema: UUID;
  /** Index name to drop */
  name: string;
};
