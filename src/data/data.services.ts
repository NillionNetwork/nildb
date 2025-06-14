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
import * as UserRepository from "#/users/users.repository";
import * as DataRepository from "./data.repository";
import type {
  CreateOwnedDataCommand,
  CreateStandardDataCommand,
  DeleteDataCommand,
  FindDataCommand,
  FlushDataCommand,
  OwnedDocumentBase,
  PartialDataDocumentDto,
  RecentDataCommand,
  StandardDocumentBase,
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
        UserRepository.upsert(ctx, {
          builder: document.owner,
          collection: command.collection,
          user: command.owner,
          data: result.created.map((id) => new UUID(id)),
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
  return DataRepository.updateMany(
    ctx,
    command.collection,
    command.filter,
    command.update,
  );
}

/**
 * Read records.
 */
export function readRecords(
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
  // This endpoint can be invoked against a standard and owned collections,
  // meaning that when the target is an owned collection we also need to
  // update the user's document
  const groupByOwner = (
    documents: StandardDocumentBase[],
  ): Record<string, UUID[]> => {
    return documents.reduce<Record<string, UUID[]>>((acc, data) => {
      if ("_owner" in data) {
        const document = data as OwnedDocumentBase;
        const { _owner } = document;

        if (!acc[_owner]) {
          acc[_owner] = [];
        }

        acc[_owner].push(data._id);
      }

      return acc;
    }, {});
  };

  const deleteAllUserDataReferences = (
    documents: Record<Did, UUID[]>,
  ): E.Effect<
    void,
    CollectionNotFoundError | DatabaseError | DataValidationError
  > => {
    return pipe(
      E.forEach(Object.entries(documents), ([owner, ids]) =>
        UserRepository.removeData(ctx, Did.parse(owner), ids),
      ),
      E.map((arrays) => arrays.flat()),
    );
  };

  // TODO: only invoke the owned check if its an owned collection
  return pipe(
    DataRepository.findMany(ctx, command.collection, command.filter),
    E.map((documents) => groupByOwner(documents)),
    E.flatMap((documents) => deleteAllUserDataReferences(documents)),
    E.flatMap(() =>
      DataRepository.deleteMany(ctx, command.collection, command.filter),
    ),
  );
}

/**
 * Flush collection.
 */
export function flushCollection(
  ctx: AppBindings,
  command: FlushDataCommand,
): E.Effect<DeleteResult, CollectionNotFoundError | DatabaseError, never> {
  return pipe(DataRepository.flushCollection(ctx, command.collection));
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
