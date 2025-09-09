import { Effect as E, pipe } from "effect";
import {
  type DeleteResult,
  type Document,
  type UpdateResult,
  UUID,
} from "mongodb";
import type { JsonObject } from "type-fest";
import * as CollectionsService from "#/collections/collections.services";
import {
  buildAccessControlledFilter,
  enforceBuilderOwnership,
} from "#/common/acl";
import type {
  CollectionNotFoundError,
  DatabaseError,
  DataValidationError,
  DocumentNotFoundError,
  InvalidIndexOptionsError,
  ResourceAccessDeniedError,
} from "#/common/errors";
import {
  addDocumentBaseCoercions,
  applyCoercions,
  type DocumentBase,
} from "#/common/mongo";
import type { Did } from "#/common/types";
import { validateData } from "#/common/validator";
import type { AppBindings } from "#/env";
import type { QueryDocument } from "#/queries/queries.types";
import * as UsersService from "#/users/users.services";
import type {
  DeleteUserDataCommand,
  UpdateUserDataCommand,
} from "#/users/users.types";
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
  | ResourceAccessDeniedError
> {
  return pipe(
    E.Do,
    E.bind("document", () =>
      CollectionsService.find(ctx, {
        _id: command.collection,
        type: "owned",
      }),
    ),
    E.tap(({ document }) =>
      enforceBuilderOwnership(
        command.requesterId,
        document.owner,
        "collection",
        command.collection,
      ),
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
        UsersService.upsertUser(ctx, {
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
  | ResourceAccessDeniedError
> {
  return pipe(
    E.Do,
    E.bind("document", () =>
      CollectionsService.find(ctx, {
        _id: command.collection,
        type: "standard",
      }),
    ),
    E.tap(({ document }) =>
      enforceBuilderOwnership(
        command.requesterId,
        document.owner,
        "collection",
        command.collection,
      ),
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
  | CollectionNotFoundError
  | DatabaseError
  | DataValidationError
  | ResourceAccessDeniedError
  | DocumentNotFoundError
> {
  const { collection, filter, update, requesterId } = command;
  return pipe(
    applyCoercions<Record<string, unknown>>(addDocumentBaseCoercions(filter)),
    E.flatMap((coercedFilter) =>
      buildAccessControlledFilter(
        ctx,
        requesterId,
        collection,
        "write",
        coercedFilter,
      ),
    ),
    E.flatMap((secureFilter) =>
      UsersService.updateUserData(ctx, collection, secureFilter).pipe(
        E.flatMap(() =>
          DataRepository.updateMany(ctx, collection, secureFilter, update),
        ),
      ),
    ),
  );
}

/**
 * Update records for user operations (no ACL check needed).
 */
export function updateRecordsAsOwner(
  ctx: AppBindings,
  command: UpdateUserDataCommand,
): E.Effect<
  UpdateResult,
  CollectionNotFoundError | DatabaseError | DataValidationError
> {
  const { collection, filter, update } = command;
  return pipe(
    applyCoercions<Record<string, unknown>>(addDocumentBaseCoercions(filter)),
    E.flatMap((coercedFilter) =>
      UsersService.updateUserData(ctx, collection, coercedFilter).pipe(
        E.flatMap(() =>
          DataRepository.updateMany(ctx, collection, coercedFilter, update),
        ),
      ),
    ),
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
  | CollectionNotFoundError
  | DatabaseError
  | DataValidationError
  | ResourceAccessDeniedError
  | DocumentNotFoundError
> {
  return pipe(
    applyCoercions<Record<string, unknown>>(
      addDocumentBaseCoercions(command.filter),
    ),
    E.flatMap((coercedFilter) =>
      buildAccessControlledFilter(
        ctx,
        command.requesterId,
        command.collection,
        "read",
        coercedFilter,
      ),
    ),
    E.flatMap((secureFilter) =>
      DataRepository.findMany(ctx, command.collection, secureFilter),
    ),
  );
}

/**
 * Delete data records.
 */
export function deleteData(
  ctx: AppBindings,
  command: DeleteDataCommand,
): E.Effect<
  DeleteResult,
  | CollectionNotFoundError
  | DatabaseError
  | DataValidationError
  | ResourceAccessDeniedError
  | DocumentNotFoundError,
  never
> {
  return pipe(
    applyCoercions<Record<string, unknown>>(
      addDocumentBaseCoercions(command.filter),
    ),
    E.flatMap((coercedFilter) =>
      buildAccessControlledFilter(
        ctx,
        command.requesterId,
        command.collection,
        "write",
        coercedFilter,
      ),
    ),
    E.flatMap((secureFilter) =>
      pipe(
        // This deletes the owned documents from the users, the standard documents are skipped.
        UsersService.deleteUserDataReferences(
          ctx,
          command.collection,
          secureFilter,
        ),
        // This updates both owned and standard documents.
        E.flatMap(() =>
          DataRepository.deleteMany(ctx, command.collection, secureFilter),
        ),
      ),
    ),
  );
}

/**
 * Delete data records for user operations (no ACL check needed).
 */
export function deleteDataAsOwner(
  ctx: AppBindings,
  command: DeleteUserDataCommand,
): E.Effect<
  DeleteResult,
  CollectionNotFoundError | DatabaseError | DataValidationError,
  never
> {
  return pipe(
    applyCoercions<Record<string, unknown>>(
      addDocumentBaseCoercions(command.filter),
    ),
    E.flatMap((coercedFilter) =>
      pipe(
        // This deletes the owned documents from the users, the standard documents are skipped.
        UsersService.deleteUserDataReferences(
          ctx,
          command.collection,
          coercedFilter,
        ),
        // This updates both owned and standard documents.
        E.flatMap(() =>
          DataRepository.deleteMany(ctx, command.collection, coercedFilter),
        ),
      ),
    ),
  );
}

/**
 * Create data collection.
 */
export function create(
  ctx: AppBindings,
  collection: UUID,
): E.Effect<void, InvalidIndexOptionsError | DatabaseError, never> {
  return DataRepository.createCollection(ctx, collection);
}

/**
 * Drop data collection.
 */
export function drop(
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
    E.flatMap(() => DataRepository.drop(ctx, collection)),
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
  | DataValidationError
  | CollectionNotFoundError
  | DatabaseError
  | ResourceAccessDeniedError
  | DocumentNotFoundError,
  never
> {
  return pipe(
    buildAccessControlledFilter(
      ctx,
      command.requesterId,
      command.collection,
      "write",
      {},
    ),
    E.flatMap((secureFilter) =>
      pipe(
        // This deletes the owned documents from the users, the standard documents are skipped.
        UsersService.deleteUserDataReferences(
          ctx,
          command.collection,
          secureFilter,
        ),
        // This updates both owned and standard documents.
        E.flatMap(() =>
          DataRepository.flushCollection(ctx, command.collection),
        ),
      ),
    ),
  );
}

/**
 * Tail data.
 */
export function tailData(
  ctx: AppBindings,
  command: RecentDataCommand,
): E.Effect<
  DocumentBase[],
  | CollectionNotFoundError
  | DatabaseError
  | ResourceAccessDeniedError
  | DocumentNotFoundError
  | DataValidationError,
  never
> {
  return pipe(
    buildAccessControlledFilter(
      ctx,
      command.requesterId,
      command.collection,
      "read",
      {},
    ),
    E.flatMap(() =>
      DataRepository.tailCollection(ctx, command.collection, command.limit),
    ),
  );
}

/**
 * Run aggregation pipeline on a collection.
 *
 * @param ctx - Application context containing bindings and services.
 * @param query - Query document containing the collection and other parameters.
 * @param pipeline - Aggregation pipeline to execute on the collection.
 * @param requesterId - Requester ID for access control.
 */
export function runAggregation(
  ctx: AppBindings,
  query: QueryDocument,
  pipeline: Document[],
  requesterId: Did,
): E.Effect<
  JsonObject[],
  | CollectionNotFoundError
  | DatabaseError
  | DataValidationError
  | ResourceAccessDeniedError
  | DocumentNotFoundError
> {
  return pipe(
    buildAccessControlledFilter(
      ctx,
      requesterId,
      query.collection,
      "execute",
      {},
    ),
    E.flatMap((secureFilter) => {
      // Prepend the ACL filter as a $match stage to the pipeline
      const securePipeline = [{ $match: secureFilter }, ...pipeline];
      return DataRepository.runAggregation(ctx, query, securePipeline);
    }),
  );
}
