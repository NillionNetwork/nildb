import type { UUID } from "mongodb";
import type { DocumentBase } from "#/common/mongo";
import type { Did } from "#/common/types";
import type { DeleteDataCommand, UpdateDataCommand } from "#/data/data.types";
import type { UserDataLogs } from "#/users/users.dto";

/**
 * Access control list entry.
 */
export type Acl = {
  grantee: Did;
  read: boolean;
  write: boolean;
  execute: boolean;
};

/**
 * Delete data command.
 */
export type DeleteUserDataCommand = DeleteDataCommand & {
  owner: Did;
  document: UUID;
};

/**
 * Data document reference.
 */
export type DataDocumentReference = {
  builder: Did;
  collection: UUID;
  document: UUID;
};

/**
 * User document.
 */
export type UserDocument = DocumentBase<Did> & {
  data: DataDocumentReference[];
  log: UserDataLogs[];
};

/**
 * Update data command.
 */
export type UpdateUserDataCommand = UpdateDataCommand & {
  document: UUID;
};

/**
 * Read data ACL command.
 */
export type ReadDataAclCommand = {
  owner: Did;
  collection: UUID;
  document: UUID;
};

/**
 * Grant data access command.
 */
export type GrantAccessToDataCommand = {
  collection: UUID;
  document: UUID;
  owner: Did;
  acl: Acl;
};

/**
 * Revoke data access command.
 */
export type RevokeAccessToDataCommand = {
  collection: UUID;
  document: UUID;
  grantee: Did;
  owner: Did;
};
