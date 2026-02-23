import type { ObjectId, UUID } from "mongodb";

/**
 * Builder status for credit-based access control.
 */
export type BuilderStatus =
  | "free_tier" // Using free tier (no credits required)
  | "active" // Has credits, full access
  | "warning" // Credits low, still full access
  | "read_only" // No credits, read-only access
  | "suspended" // Long-term no credits, profile only
  | "pending_purge"; // Scheduled for data deletion

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
  // Credit system fields (optional for backward compatibility)
  creditsUsd?: number;
  status?: BuilderStatus;
  storageBytes?: number;
  lastBillingCycle?: Date;
  lastCreditTopUp?: Date | null;
  creditsDepleted?: Date | null;
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
