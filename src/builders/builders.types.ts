import type { UUID } from "mongodb";
import type { Did } from "#/common/types";

/**
 * Builder document.
 */
export type BuilderDocument = {
  _id: Did;
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
  did: Did;
  name: string;
};

/**
 * Update builder profile command.
 */
export type UpdateProfileCommand = {
  builder: Did;
  updates: Partial<{
    _updated: Date;
    name: string;
  }>;
};

/**
 * Create collection command.
 */
export type AddBuilderCollectionCommand = {
  did: Did;
  collection: UUID;
};

/**
 * Create collection command.
 */
export type RemoveBuilderCollectionCommand = {
  did: Did;
  collection: UUID;
};

/**
 * Create query command.
 */
export type AddBuilderQueryCommand = {
  did: Did;
  query: UUID;
};

/**
 * Create query command.
 */
export type RemoveBuilderQueryCommand = {
  did: Did;
  query: UUID;
};
