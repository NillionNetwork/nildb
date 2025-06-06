import type { UUID } from "mongodb";
import type { Did } from "#/common/types";

/**
 * Represents an organisation account document in the database.
 *
 * This type serves as the common data model across all layers,
 * maintaining consistency between service and repository operations.
 */
export type OrganizationAccountDocument = {
  _id: Did;
  _role: "organization";
  _created: Date;
  _updated: Date;
  name: string;
  schemas: UUID[];
  queries: UUID[];
};

/**
 * Domain command types for account operations.
 *
 * These types represent business operations that can be performed
 * on accounts, converted from DTOs at the boundary layer.
 */

/**
 * Command for creating a new organization account.
 *
 * Encapsulates the data needed to register a new organization
 * in the system.
 */
export type CreateAccountCommand = {
  /** Decentralized identifier for the organization */
  did: Did;
  /** Display name for the organization */
  name: string;
};

/**
 * Command for updating an existing account profile.
 *
 * Contains the account identifier and the fields to update.
 * Only provided fields will be updated.
 */
export type UpdateProfileCommand = {
  /** Account identifier to update */
  accountId: Did;
  /** Profile updates to apply (only provided fields are updated) */
  updates: Partial<{
    /** New display name for the organization */
    name: string;
  }>;
};
