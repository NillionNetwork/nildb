import type { UUID } from "mongodb";
import type { DocumentBase } from "#/common/mongo";
import type { Did, UuidDto } from "#/common/types";
import type { Acl } from "#/users/users.types";

export type StandardDocumentBase<
  T extends Record<string, unknown> = Record<string, unknown>,
> = DocumentBase & T;

export type OwnedDocumentBase<
  T extends Record<string, unknown> = Record<string, unknown>,
> = StandardDocumentBase<T> & {
  _owner: Did;
  _acl: Acl[];
};

export type CreateFailure = {
  error: string;
  document: unknown;
};

export type UploadResult = {
  created: UuidDto[];
  errors: CreateFailure[];
};

/**
 * Partial data document structure for internal processing.
 */
export type PartialDataDocumentDto = Record<string, unknown>[] & {
  /** System-generated UUID for the data document */
  _id: UuidDto;
};

/**
 * Command for creating/uploading owned data records.
 */
export type CreateOwnedDataCommand = {
  /** Id of the collection to store data in */
  collection: UUID;
  /** DID of the data owner */
  owner: Did;
  /** Permissions for the data records */
  acl: Acl;
  /** Array of data records to store */
  data: Record<string, unknown>[];
};

/**
 * Command for creating/uploading standard data records.
 */
export type CreateStandardDataCommand = {
  /** Id of the collection to store data in */
  collection: UUID;
  /** Array of data records to store */
  data: Record<string, unknown>[];
};

/**
 * Command for updating data records.
 */
export type UpdateDataCommand = {
  /** Id of the collection containing the data */
  collection: UUID;
  /** MongoDB filter to match records for update */
  filter: Record<string, unknown>;
  /** MongoDB update operations to apply */
  update: Record<string, unknown>;
};

/**
 * Command for reading data records.
 */
export type FindDataCommand = {
  /** Id of the collection to read from */
  collection: UUID;
  /** MongoDB filter to match records for retrieval */
  filter: Record<string, unknown>;
};

/**
 * Command for deleting data records.
 */
export type DeleteDataCommand = {
  /** Id of the collection containing the data */
  collection: UUID;
  /** MongoDB filter to match records for deletion */
  filter: Record<string, unknown>;
};

/**
 * Command for flushing all data from a schema collection.
 */
export type FlushDataCommand = {
  /** Id of the collection to flush */
  collection: UUID;
};

/**
 * Command for tailing recent data from a schema collection.
 */
export type RecentDataCommand = {
  /** Id of the collection to tail */
  collection: UUID;
  /** The max number of documents to return */
  limit: number;
};
