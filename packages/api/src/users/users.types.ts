import type { DocumentBase } from "@nildb/common/mongo";
import type { ObjectId, UUID } from "mongodb";

import type { UserDataLogs } from "@nillion/nildb-types";

/**
 * Permission type for ACL operations.
 */
export type Permission = "read" | "write" | "execute";

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
export type DeleteUserDataCommand = {
  collection: UUID;
  filter: Record<string, unknown>;
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
export type UserDocument = DocumentBase<ObjectId> & {
  did: string;
  data: DataDocumentReference[];
  logs: UserDataLogs[];
};

/**
 * Update data command.
 */
export type UpdateUserDataCommand = {
  collection: UUID;
  filter: Record<string, unknown>;
  update: Record<string, unknown>;
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
