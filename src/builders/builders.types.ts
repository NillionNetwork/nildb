import type { UUID } from "mongodb";
import type { Did } from "#/common/types";

/**
 * Represents a builder document in the database.
 */
export type BuilderDocument = {
  _id: Did;
  _created: Date;
  _updated: Date;
  name: string;
  schemas: UUID[];
  queries: UUID[];
};

/**
 * Domain command types for builder operations.
 */

/**
 * Command for creating a new builder.
 */
export type CreateBuilderCommand = {
  /** The builder's did */
  did: Did;
  /** The builder's display name */
  name: string;
};

/**
 * Command for updating an existing builder profile.
 */
export type UpdateProfileCommand = {
  /** The builder's identifier */
  builder: Did;
  /** Updates to apply  */
  updates: Partial<{
    /** Timestamp for when this update was made **/
    _updated: Date;
    /** New display name for the builder */
    name: string;
  }>;
};
