import type { UUID } from "mongodb";
import type { DocumentBase } from "#/common/mongo";
import type { Did } from "#/common/types";

export type Acl = {
  grantee: Did;
  read: boolean;
  write: boolean;
  execute: boolean;
};

export type DeleteDataCommand = {
  owner: Did;
  collection: UUID;
  document: UUID;
};

/**
 * User operation log entry types.
 */
export type LogOperation =
  | { op: "write"; col: UUID }
  | { op: "delete"; col: UUID }
  | { op: "auth"; col: UUID; acl: Acl };

/**
 *
 */
export type DataDocumentReference = {
  builder: Did;
  collection: UUID;
  document: UUID;
};

/**
 *
 */
export type UserDocument = DocumentBase<Did> & {
  data: DataDocumentReference[];
  log: LogOperation[];
};

/**
 *
 */
export type ReadDataAclCommand = {
  owner: Did;
  collection: UUID;
  document: UUID;
};

/**
 *
 */
export type GrantAccessToDataCommand = {
  collection: UUID;
  document: UUID;
  owner: Did;
  acl: Acl;
};

/**
 *
 */
export type RevokeAccessToDataCommand = {
  collection: UUID;
  document: UUID;
  grantee: Did;
  owner: Did;
};
