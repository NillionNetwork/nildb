import { Effect as E, pipe } from "effect";
import type { DeleteResult, UpdateResult, UUID } from "mongodb";
import type {
  CollectionNotFoundError,
  DatabaseError,
  DataValidationError,
  DocumentNotFoundError,
} from "#/common/errors";
import { DidSchema, Uuid } from "#/common/types";
import { validateData } from "#/common/validator";
import type { AppBindings } from "#/env";
import * as SchemasRepository from "#/schemas/schemas.repository";
import * as UserRepository from "#/users/users.repository";
import type { DataDocument, UploadResult } from "./data.repository";
import * as DataRepository from "./data.repository";
import type {
  CreateOwnedRecordsCommand,
  CreateStandardRecordsCommand,
  DeleteRecordsCommand,
  FlushCollectionCommand,
  PartialDataDocumentDto,
  ReadRecordsCommand,
  TailDataCommand,
  UpdateRecordsCommand,
} from "./data.types";

/**
 * Creates owned data records in a schema-validated collection.
 *
 * Validates data against the schema, inserts records with ownership tracking,
 * and manages user permissions for owned document types. Handles both shared
 * and user-owned data collections based on schema configuration.
 *
 * @param ctx - Application bindings with database and logging context
 * @param command - Create records command with data and ownership information
 * @returns Effect that succeeds with upload result or fails with validation/database errors
 */
export function createOwnedRecords(
  ctx: AppBindings,
  command: CreateOwnedRecordsCommand,
): E.Effect<
  UploadResult,
  | DataValidationError
  | DocumentNotFoundError
  | CollectionNotFoundError
  | DatabaseError
> {
  return pipe(
    E.Do,
    E.bind("document", () =>
      SchemasRepository.findOne(ctx, {
        _id: command.schemaId,
        documentType: "owned",
      }),
    ),
    E.bind("data", ({ document }) =>
      validateData<PartialDataDocumentDto[]>(document.schema, command.data),
    ),
    E.bind("result", ({ document, data }) =>
      DataRepository.insertOwnedData(
        ctx,
        document,
        data,
        command.owner,
        command.permissions ? [command.permissions] : [],
      ),
    ),
    E.flatMap(({ result }) => {
      return UserRepository.upsert(
        ctx,
        command.owner,
        command.schemaId,
        result.created.map((id) => Uuid.parse(id)),
        command.permissions,
      ).pipe(E.flatMap(() => E.succeed(result)));
    }),
  );
}

/**
 * Creates data records in a schema-validated collection.
 *
 * Validates data against the schema, inserts records with ownership tracking,
 * and manages user permissions for owned document types. Handles both shared
 * and user-owned data collections based on schema configuration.
 *
 * @param ctx - Application bindings with database and logging context
 * @param command - Create records command with data and ownership information
 * @returns Effect that succeeds with upload result or fails with validation/database errors
 */
export function createStandardRecords(
  ctx: AppBindings,
  command: CreateStandardRecordsCommand,
): E.Effect<
  UploadResult,
  | DataValidationError
  | DocumentNotFoundError
  | CollectionNotFoundError
  | DatabaseError
> {
  return pipe(
    E.Do,
    E.bind("document", () =>
      SchemasRepository.findOne(ctx, {
        _id: command.schemaId,
        documentType: "standard",
      }),
    ),
    E.bind("data", ({ document }) =>
      validateData<PartialDataDocumentDto[]>(document.schema, command.data),
    ),
    E.flatMap(({ document, data }) =>
      DataRepository.insertStandardData(ctx, document, data),
    ),
  );
}

export function updateRecords(
  ctx: AppBindings,
  command: UpdateRecordsCommand,
): E.Effect<
  UpdateResult,
  CollectionNotFoundError | DatabaseError | DataValidationError
> {
  return DataRepository.updateMany(
    ctx,
    command.schema,
    command.filter,
    command.update,
  );
}

export function readRecords(
  ctx: AppBindings,
  command: ReadRecordsCommand,
): E.Effect<
  DataDocument[],
  CollectionNotFoundError | DatabaseError | DataValidationError
> {
  return DataRepository.findMany(ctx, command.schema, command.filter);
}

export function deleteRecords(
  ctx: AppBindings,
  command: DeleteRecordsCommand,
): E.Effect<
  DeleteResult,
  CollectionNotFoundError | DatabaseError | DataValidationError,
  never
> {
  const groupByOwner = (documents: DataDocument[]): Record<string, UUID[]> => {
    return documents.reduce<Record<string, UUID[]>>((acc, data) => {
      const owner = data._owner;
      if (owner) {
        if (!acc[owner]) {
          acc[owner] = [];
        }
        acc[owner].push(data._id);
      }
      return acc;
    }, {});
  };

  const deleteAllUserDataReferences = (
    documents: Record<string, UUID[]>,
  ): E.Effect<
    void,
    CollectionNotFoundError | DatabaseError | DataValidationError
  > => {
    return E.forEach(Object.entries(documents), ([owner, ids]) =>
      UserRepository.removeData(ctx, DidSchema.parse(owner), ids),
    ).pipe(E.map((arrays) => arrays.flat()));
  };

  return DataRepository.findMany(ctx, command.schema, command.filter).pipe(
    E.map((documents) => groupByOwner(documents)),
    E.flatMap((documents) => deleteAllUserDataReferences(documents)),
    E.flatMap(() =>
      DataRepository.deleteMany(ctx, command.schema, command.filter),
    ),
  );
}

export function flushCollection(
  ctx: AppBindings,
  command: FlushCollectionCommand,
): E.Effect<DeleteResult, CollectionNotFoundError | DatabaseError, never> {
  return pipe(DataRepository.flushCollection(ctx, command.schema));
}

export function tailData(
  ctx: AppBindings,
  command: TailDataCommand,
): E.Effect<DataDocument[], CollectionNotFoundError | DatabaseError, never> {
  return pipe(DataRepository.tailCollection(ctx, command.schema));
}
