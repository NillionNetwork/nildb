import type { UUID } from "mongodb";
import type { DocumentBase } from "#/common/mongo";
import type { Did } from "#/common/types";
import type { GrantedAccess, Permissions } from "#/user/user.dto";

/**
 * Domain types for user data management and permissions.
 *
 * These types define the structure for user documents that track
 * data ownership and access control across the NilDB system.
 */

/**
 * User operation log entry types.
 *
 * Tracks different operations performed by users on data:
 * - "write": Data creation or modification in a collection
 * - "delete": Data removal from a collection
 * - "auth": Permission changes for data access control
 */
export type LogOperation =
  | { op: "create-data"; document: UUID }
  | { op: "update-data"; document: UUID }
  | { op: "delete-data"; document: UUID }
  | { op: "grant-access"; document: UUID; did: Did; perms: Permissions }
  | { op: "update-access"; document: UUID; did: Did; perms: Permissions }
  | { op: "revoke-access"; document: UUID; did: Did };

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
  grantAccess: GrantedAccess;
};

/**
 * Domain request for updating permissions.
 */
export type UpdatePermissionsCommand = {
  schema: UUID;
  documentId: UUID;
  grantAccess: GrantedAccess;
};

/**
 * Domain request for deleting permissions.
 */
export type DeletePermissionsCommand = {
  schema: UUID;
  documentId: UUID;
  did: Did;
};
