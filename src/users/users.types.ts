import type { UUID } from "mongodb";
import type { DocumentBase } from "#/common/mongo";
import type { Did } from "#/common/types";
import type { FindDataCommand } from "#/data/data.types";

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
export type DeleteDataCommand = {
  owner: Did;
  collection: UUID;
  document: UUID;
};

/**
 * User operation log entry.
 */
export type LogOperation =
  | { op: "write"; col: UUID }
  | { op: "delete"; col: UUID }
  | { op: "auth"; col: UUID; acl: Acl };

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
  log: LogOperation[];
};

/**
 * Read data command.
 */
export type ReadDataCommand = FindDataCommand & {
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
