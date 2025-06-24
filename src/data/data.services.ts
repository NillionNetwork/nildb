import { Effect as E, pipe } from "effect";
import { type DeleteResult, type UpdateResult, UUID } from "mongodb";
import * as CollectionsRepository from "#/collections/collections.repository";
import type {
  CollectionNotFoundError,
  DatabaseError,
  DataValidationError,
  DocumentNotFoundError,
} from "#/common/errors";
import type { DocumentBase } from "#/common/mongo";
import { Did } from "#/common/types";
import { validateData } from "#/common/validator";
import type { AppBindings } from "#/env";
import { UserDataMapper, UserLoggerMapper } from "#/users/users.mapper";
import * as UsersRepository from "#/users/users.repository";
import * as UsersService from "#/users/users.services";
import * as DataRepository from "./data.repository";
import type {
  CreateOwnedDataCommand,
  CreateStandardDataCommand,
  DeleteDataCommand,
  FindDataCommand,
  FlushDataCommand,
  PartialDataDocumentDto,
  ReadDataCommand,
  RecentDataCommand,
  UpdateDataCommand,
  UploadResult,
} from "./data.types";

/**
 * Create owned records.
 */
export function createOwnedRecords(
  ctx: AppBindings,
  command: CreateOwnedDataCommand,
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
      CollectionsRepository.findOne(ctx, {
        _id: command.collection,
        type: "owned",
      }),
    ),
    E.bind("data", ({ document }) =>
      validateData<PartialDataDocumentDto[]>(document.schema, command.data),
    ),
    E.bind("result", ({ document, data }) =>
      DataRepository.insertOwnedData(ctx, document, data, command.owner, [
        command.acl,
      ]),
    ),
    E.flatMap(({ result, document }) =>
      pipe(
        UsersRepository.upsert(ctx, {
          user: command.owner,
          data: result.created.map((id) => ({
            builder: document.owner,
            document: new UUID(id),
            collection: command.collection,
          })),
          acl: command.acl,
        }),
        E.map(() => result),
      ),
    ),
  );
}

/**
 * Create standard records.
 */
export function createStandardRecords(
  ctx: AppBindings,
  command: CreateStandardDataCommand,
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
      CollectionsRepository.findOne(ctx, {
        _id: command.collection,
        type: "standard",
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

/**
 * Update records.
 */
export function updateRecords(
  ctx: AppBindings,
  command: UpdateDataCommand,
): E.Effect<
  UpdateResult,
  CollectionNotFoundError | DatabaseError | DataValidationError
> {
  const { collection, filter, update } = command;

  const updateUserLogs = (
    documents: Record<Did, UUID[]>,
  ): E.Effect<
    void,
    CollectionNotFoundError | DatabaseError | DataValidationError
  > => {
    return E.forEach(Object.entries(documents), ([owner, ids]) =>
      UsersRepository.updateUserLogs(
        ctx,
        Did.parse(owner),
        UserLoggerMapper.toUpdateDataLogs(ids),
      ),
    );
  };
  const findFilter = {
    ...command.filter,
    _owner: { $exists: true }, // Ensure we only update owned documents
  };
  return pipe(
    DataRepository.findMany(ctx, command.collection, findFilter),
    // This returns the owned documents grouped by owner, the standard documents are skipped.
    E.map((documents) => UserDataMapper.groupByOwner(documents)),
    E.flatMap((ownedDocuments) => updateUserLogs(ownedDocuments)),
    // This updates both owned and standard documents.
    E.flatMap(() => DataRepository.updateMany(ctx, collection, filter, update)),
  );
}

/**
 * Read record.
 */
export function readRecord(
  ctx: AppBindings,
  command: ReadDataCommand,
): E.Effect<
  DocumentBase,
  | DocumentNotFoundError
  | CollectionNotFoundError
  | DatabaseError
  | DataValidationError
> {
  return DataRepository.findOne(ctx, command.collection, command.filter);
}

/**
 * Find records.
 */
export function findRecords(
  ctx: AppBindings,
  command: FindDataCommand,
): E.Effect<
  DocumentBase[],
  CollectionNotFoundError | DatabaseError | DataValidationError
> {
  return DataRepository.findMany(ctx, command.collection, command.filter);
}

/**
 * Delete data records.
 */
export function deleteData(
  ctx: AppBindings,
  command: DeleteDataCommand,
): E.Effect<
  DeleteResult,
  CollectionNotFoundError | DatabaseError | DataValidationError,
  never
> {
  return pipe(
    // This deletes the owned documents from the users, the standard documents are skipped.
    UsersService.deleteUserDataReferences(
      ctx,
      command.collection,
      command.filter,
    ),
    // This updates both owned and standard documents.
    E.flatMap(() =>
      DataRepository.deleteMany(ctx, command.collection, command.filter),
    ),
  );
}

/**
 * Delete data records.
 */
export function deleteCollection(
  ctx: AppBindings,
  collection: UUID,
): E.Effect<
  void,
  CollectionNotFoundError | DatabaseError | DataValidationError,
  never
> {
  return pipe(
    // This deletes the owned documents from the users, the standard documents are skipped.
    UsersService.deleteUserDataReferences(ctx, collection, {}),
    // This updates both owned and standard documents.
    E.flatMap(() => DataRepository.deleteCollection(ctx, collection)),
  );
}

/**
 * Flush collection.
 */
export function flushCollection(
  ctx: AppBindings,
  command: FlushDataCommand,
): E.Effect<
  DeleteResult,
  DataValidationError | CollectionNotFoundError | DatabaseError,
  never
> {
  return pipe(
    // This deletes the owned documents from the users, the standard documents are skipped.
    UsersService.deleteUserDataReferences(ctx, command.collection, {}),
    // This updates both owned and standard documents.
    E.flatMap(() => DataRepository.flushCollection(ctx, command.collection)),
  );
}

/**
 * Tail data.
 */
export function tailData(
  ctx: AppBindings,
  command: RecentDataCommand,
): E.Effect<DocumentBase[], CollectionNotFoundError | DatabaseError, never> {
  return pipe(
    DataRepository.tailCollection(ctx, command.collection, command.limit),
  );
}
