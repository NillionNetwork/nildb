import type { UUID } from "mongodb";
import type { Did, UuidDto } from "#/common/types";
import type { Permissions } from "#/user/user.types";

/**
 * Domain types for data storage and management operations.
 *
 * These types define the structure for data documents and related
 * operations within schema-validated collections in the NilDB system.
 */

/**
 * Partial data document structure for internal processing.
 *
 * Represents user-provided data records with system-generated identifiers.
 * This intersection type combines an array of records with an ID field,
 * used during the data validation and insertion pipeline.
 *
 * Note: This type uses intersection with arrays to maintain compatibility
 * with existing validation logic while adding the ID requirement.
 */
export type PartialDataDocumentDto = Record<string, unknown>[] & {
  /** System-generated UUID for the data document */
  _id: UuidDto;
};

/**
 * Domain command types for data operations.
 *
 * These types represent business operations that can be performed
 * on data, converted from DTOs at the boundary layer.
 */

/**
 * Command for creating/uploading data records.
 *
 * Encapsulates the data needed to create new records in a schema collection
 * with proper ownership and permissions.
 */
export type CreateRecordsCommand = {
  /** DID of the data owner */
  owner: Did;
  /** UUID of the schema (collection) to store data in */
  schemaId: UUID;
  /** Array of data records to store */
  data: Record<string, unknown>[];
  /** Optional permissions for the data records */
  permissions?: Permissions;
};

/**
 * Command for updating data records.
 *
 * Encapsulates the filter and update operations for modifying
 * existing records in a schema collection.
 */
export type UpdateRecordsCommand = {
  /** UUID of the schema (collection) containing the data */
  schema: UUID;
  /** MongoDB filter to match records for update */
  filter: Record<string, unknown>;
  /** MongoDB update operations to apply */
  update: Record<string, unknown>;
};

/**
 * Command for reading data records.
 *
 * Encapsulates the schema and filter for retrieving records
 * from a schema collection.
 */
export type ReadRecordsCommand = {
  /** UUID of the schema (collection) to read from */
  schema: UUID;
  /** MongoDB filter to match records for retrieval */
  filter: Record<string, unknown>;
};

/**
 * Command for deleting data records.
 *
 * Encapsulates the schema and filter for removing records
 * from a schema collection.
 */
export type DeleteRecordsCommand = {
  /** UUID of the schema (collection) containing the data */
  schema: UUID;
  /** MongoDB filter to match records for deletion */
  filter: Record<string, unknown>;
};

/**
 * Command for flushing all data from a schema collection.
 *
 * Encapsulates the schema identifier for removing all records
 * from a collection.
 */
export type FlushCollectionCommand = {
  /** UUID of the schema (collection) to flush */
  schema: UUID;
};

/**
 * Command for tailing recent data from a schema collection.
 *
 * Encapsulates the schema identifier for retrieving the most
 * recent records from a collection.
 */
export type TailDataCommand = {
  /** UUID of the schema (collection) to tail */
  schema: UUID;
};
