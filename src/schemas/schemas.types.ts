import type { IndexDirection, UUID } from "mongodb";
import type { DocumentBase } from "#/common/mongo";
import type { Did } from "#/common/types";

/**
 * Schema document type enumeration.
 */
export type SchemaDocumentType = "standard" | "owned";

/**
 * Base schema document structure.
 */
export type SchemaDocumentBase = DocumentBase<UUID>;

/**
 * Complete schema document structure.
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
 * Command for adding a new schema.
 */
export type CreateSchemaCommand = {
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
 */
export type DeleteSchemaCommand = {
  /** Unique identifier of the schema to delete */
  id: UUID;
};

/**
 * Command for creating an index on a schema collection.
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
 */
export type DropIndexCommand = {
  /** Schema identifier for the collection */
  schema: UUID;
  /** Index name to drop */
  name: string;
};
