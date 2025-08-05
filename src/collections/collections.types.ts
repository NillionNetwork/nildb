import type { IndexDirection, UUID } from "mongodb";
import type { DocumentBase } from "#/common/mongo";

/**
 * Collection type.
 */
export type CollectionType = "standard" | "owned";

/**
 * Collection document.
 */
export type CollectionDocument = DocumentBase & {
  owner: string;
  name: string;
  schema: Record<string, unknown>;
  type: CollectionType;
};

/**
 * Collection metadata.
 */
export type CollectionMetadata = {
  _id: UUID;
  count: number;
  size: number;
  firstWrite: Date;
  lastWrite: Date;
  indexes: CollectionIndex[];
  schema: Record<string, unknown>;
};

/**
 * Collection index.
 */
export type CollectionIndex = {
  v: number;
  key: Record<string, IndexDirection>;
  name: string;
  unique: boolean;
};

/**
 * Create collection command.
 */
export type CreateCollectionCommand = {
  _id: UUID;
  type: CollectionType;
  owner: string;
  name: string;
  schema: Record<string, unknown>;
};

/**
 * Delete collection command.
 */
export type DeleteCollectionCommand = {
  _id: UUID;
};

/**
 * Delete collection command.
 */
export type DeleteManyCollectionsCommand = {
  collections: UUID[];
};

/**
 * Create index command.
 */
export type CreateIndexCommand = {
  collection: UUID;
  name: string;
  keys: Record<string, IndexDirection>;
  unique: boolean;
  ttl?: number;
};

/**
 * Drop index command.
 */
export type DropIndexCommand = {
  collection: UUID;
  name: string;
};

/**
 * Read collection by id command
 */
export type ReadCollectionByIdCommand = {
  id: UUID;
};
