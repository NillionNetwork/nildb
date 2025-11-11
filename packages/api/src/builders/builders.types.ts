import type { ObjectId, UUID } from "mongodb";

/**
 * Builder document.
 */
export type BuilderDocument = {
  _id: ObjectId;
  did: string;
  _created: Date;
  _updated: Date;
  name: string;
  collections: UUID[];
  queries: UUID[];
};

/**
 * Builder domain commands.
 */

/**
 * Create builder command.
 */
export type CreateBuilderCommand = {
  did: string;
  name: string;
};

/**
 * Update builder profile command.
 */
export type UpdateProfileCommand = {
  builder: string;
  updates: Partial<{
    _updated: Date;
    name: string;
  }>;
};

/**
 * Create collection command.
 */
export type AddBuilderCollectionCommand = {
  did: string;
  collection: UUID;
};

/**
 * Create collection command.
 */
export type RemoveBuilderCollectionCommand = {
  did: string;
  collection: UUID;
};

/**
 * Create query command.
 */
export type AddBuilderQueryCommand = {
  did: string;
  query: UUID;
};

/**
 * Create query command.
 */
export type RemoveBuilderQueryCommand = {
  did: string;
  query: UUID;
};
