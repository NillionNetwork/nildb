import type { UUID } from "mongodb";
import type { DocumentBase } from "#/common/mongo";
import type { DeleteDataCommand, UpdateDataCommand } from "#/data/data.types";
import type { UserDataLogs } from "#/users/users.dto";

/**
 * Access control list entry.
 */
export type Acl = {
  grantee: string;
  read: boolean;
  write: boolean;
  execute: boolean;
};

/**
 * Delete data command.
 */
export type DeleteUserDataCommand = DeleteDataCommand & {
  owner: string;
  document: UUID;
};

/**
 * Data document reference.
 */
export type DataDocumentReference = {
  builder: string;
  collection: UUID;
  document: UUID;
};

/**
 * User document.
 */
export type UserDocument = DocumentBase<string> & {
  data: DataDocumentReference[];
  logs: UserDataLogs[];
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
  owner: string;
  collection: UUID;
  document: UUID;
};

/**
 * Grant data access command.
 */
export type GrantAccessToDataCommand = {
  collection: UUID;
  document: UUID;
  owner: string;
  acl: Acl;
};

/**
 * Revoke data access command.
 */
export type RevokeAccessToDataCommand = {
  collection: UUID;
  document: UUID;
  grantee: string;
  owner: string;
};

export type UpsertUserCommand = {
  user: string;
  data: DataDocumentReference[];
  acl?: Acl;
};
