import type { UUID } from "mongodb";
import type { Did } from "#/common/types";

/**
 * Represents an organisation builder document in the database.
 *
 * This type serves as the common data model across all layers,
 * maintaining consistency between service and repository operations.
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
 *
 * These types represent business operations that can be performed
 * on builders, converted from DTOs at the boundary layer.
 */

/**
 * Command for creating a new organization builder.
 *
 * Encapsulates the data needed to register a new organization
 * in the system.
 */
export type CreateBuilderCommand = {
  /** Decentralized identifier for the organization */
  did: Did;
  /** Display name for the organization */
  name: string;
};

/**
 * Command for updating an existing builder profile.
 *
 * Contains the builder identifier and the fields to update.
 * Only provided fields will be updated.
 */
export type UpdateProfileCommand = {
  /** Builder identifier to update */
  builderId: Did;
  /** Profile updates to apply (only provided fields are updated) */
  updates: Partial<{
    /** Timestamp for when this update was made **/
    _updated: Date;
    /** New display name for the organization */
    name: string;
  }>;
};
