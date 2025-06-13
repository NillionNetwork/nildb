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
