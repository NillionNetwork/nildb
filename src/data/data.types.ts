import type { UUID } from "mongodb";
import type { DocumentBase } from "#/common/mongo";
import type { UuidDto } from "#/common/types";
import type { Acl } from "#/users/users.types";

/**
 * Standard document base.
 */
export type StandardDocumentBase<
  T extends Record<string, unknown> = Record<string, unknown>,
> = DocumentBase & T;

/**
 * Owned document base.
 */
export type OwnedDocumentBase<
  T extends Record<string, unknown> = Record<string, unknown>,
> = StandardDocumentBase<T> & {
  _owner: string;
  _acl: Acl[];
};

/**
 * Data creation failure.
 */
export type CreateFailure = {
  error: string;
  document: unknown;
};

/**
 * Data upload result.
 */
export type UploadResult = {
  created: UuidDto[];
  errors: CreateFailure[];
};

/**
 * Partial data document.
 */
export type PartialDataDocumentDto = Record<string, unknown>[] & {
  _id: UuidDto;
};

/**
 * Create owned data command.
 */
export type CreateOwnedDataCommand = {
  collection: UUID;
  owner: string;
  acl: Acl;
  data: Record<string, unknown>[];
  requesterId: string;
};

/**
 * Create standard data command.
 */
export type CreateStandardDataCommand = {
  collection: UUID;
  data: Record<string, unknown>[];
  requesterId: string;
};

/**
 * Update data command.
 */
export type UpdateDataCommand = {
  collection: UUID;
  filter: Record<string, unknown>;
  update: Record<string, unknown>;
  requesterId: string;
};

/**
 * Read data command.
 */
export type ReadDataCommand = {
  document: UUID;
  collection: UUID;
  filter: Record<string, unknown>;
};

/**
 * Find data command.
 */
export type FindDataCommand = {
  collection: UUID;
  filter: Record<string, unknown>;
  requesterId: string;
};

/**
 * Delete data command.
 */
export type DeleteDataCommand = {
  collection: UUID;
  filter: Record<string, unknown>;
  requesterId: string;
};

/**
 * Flush data command.
 */
export type FlushDataCommand = {
  collection: UUID;
  requesterId: string;
};

/**
 * Recent data command.
 */
export type RecentDataCommand = {
  collection: UUID;
  limit: number;
  requesterId: string;
};
