import type { UUID } from "mongodb";
import type { DocumentBase } from "#/common/mongo";
import type { Did } from "#/common/types";

/**
 * Domain types for user data management and permissions.
 *
 * These types define the structure for user documents that track
 * data ownership and access control across the NilDB system.
 */

/**
 * Permission configuration for data access control.
 *
 * Encapsulates the access rights granted to a specific DID
 * for operations on data documents.
 */
export class Permissions {
  /**
   * Creates a new permission configuration.
   *
   * @param did - The decentralized identifier granted permissions
   * @param perms - The permission flags for read, write, and execute operations
   */
  constructor(
    public readonly did: Did,
    public readonly perms: {
      /** Whether the DID can read the data */
      read: boolean;
      /** Whether the DID can modify the data */
      write: boolean;
      /** Whether the DID can execute queries on the data */
      execute: boolean;
    } = { read: false, write: false, execute: false }, // Default permissions
  ) {}
}

/**
 * User operation log entry types.
 *
 * Tracks different operations performed by users on data:
 * - "write": Data creation or modification in a collection
 * - "delete": Data removal from a collection
 * - "auth": Permission changes for data access control
 */
export type LogOperation =
  | { op: "write"; col: UUID }
  | { op: "delete"; col: UUID }
  | { op: "auth"; col: UUID; perms: Permissions };

/**
 * Reference to a data document owned by a user.
 *
 * Links user documents to their data across different schema collections.
 */
export type DataDocumentReference = {
  /** Unique identifier of the data document */
  id: UUID;
  /** Schema collection containing the data document */
  schema: UUID;
};

/**
 * User document structure in the database.
 *
 * Tracks user-owned data references and operation history
 * for audit and access control purposes.
 */
export type UserDocument = DocumentBase<Did> & {
  /** Array of references to data documents owned by this user */
  data: DataDocumentReference[];
  /** Audit log of operations performed by this user */
  log: LogOperation[];
};

/**
 * Domain request for reading permissions.
 */
export type ReadPermissionsCommand = {
  schema: UUID;
  documentId: UUID;
};

/**
 * Domain request for adding permissions.
 */
export type AddPermissionsCommand = {
  schema: UUID;
  documentId: UUID;
  permissions: Permissions;
};

/**
 * Domain request for updating permissions.
 */
export type UpdatePermissionsCommand = {
  schema: UUID;
  documentId: UUID;
  permissions: Permissions;
};

/**
 * Domain request for deleting permissions.
 */
export type DeletePermissionsCommand = {
  schema: UUID;
  documentId: UUID;
  did: Did;
};
