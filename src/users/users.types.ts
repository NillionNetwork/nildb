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
  schema: UUID;
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
  schema: UUID;
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
  schema: UUID;
  document: UUID;
};

/**
 *
 */
export type GrantAccessToDataCommand = {
  schema: UUID;
  document: UUID;
  owner: Did;
  acl: Acl;
};

/**
 *
 */
export type RevokeAccessToDataCommand = {
  schema: UUID;
  document: UUID;
  grantee: Did;
  owner: Did;
};
