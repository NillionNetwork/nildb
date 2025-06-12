import type { IndexDirection, UUID } from "mongodb";
import type { DocumentBase } from "#/common/mongo";
import type { Did } from "#/common/types";

/**
 * Collection types.
 */
export type CollectionType = "standard" | "owned";

/**
 * Collection document.
 */
export type CollectionDocument = DocumentBase & {
  /** The collection owner's Did */
  owner: Did;
  /** Human-readable name for the collection */
  name: string;
  /** JSON Schema definition for data validation */
  schema: Record<string, unknown>;
  /** Access control type for documents stored in this collection */
  type: CollectionType;
};

/**
 * Collection metadata and statistics.
 */
export type CollectionMetadata = {
  /** The collection's unique identifier */
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
 * Command for creating a new collection.
 */
export type CreateCollectionCommand = {
  /** Target collection id */
  id: UUID;
  /** Access control type for data stored under this collection */
  type: CollectionType;
  /** DID of the builder that owns this collection */
  owner: Did;
  /** Human-readable name for the collection */
  name: string;
  /** JSON Schema definition for data validation */
  schema: Record<string, unknown>;
};

/**
 * Command for deleting a collection.
 */
export type DeleteCollectionCommand = {
  /** The collection's id to delete */
  id: UUID;
};

/**
 * Command for creating an index on a collection.
 */
export type CreateIndexCommand = {
  /** Target collection id */
  collection: UUID;
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
 * Command for dropping an index from a collection.
 */
export type DropIndexCommand = {
  /** Target collection id */
  collection: UUID;
  /** Index name to drop */
  name: string;
};
