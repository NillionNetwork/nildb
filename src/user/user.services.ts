import { Effect as E } from "effect";
import type { UpdateResult, UUID } from "mongodb";
import type {
  CollectionNotFoundError,
  DatabaseError,
  DataValidationError,
  DocumentNotFoundError,
} from "#/common/errors";
import type { Did } from "#/common/types";
import { Uuid } from "#/common/types";
import type { DataDocument } from "#/data/data.repository";
import * as DataRepository from "#/data/data.repository";
import type { AppBindings } from "#/env";
import * as UserRepository from "./user.repository";
import {
  type AddPermissionsCommand,
  type DeletePermissionsCommand,
  Permissions,
  type ReadPermissionsCommand,
  type UpdatePermissionsCommand,
  type UserDocument,
} from "./user.types";

/**
 * Retrieves a user document by DID.
 *
 * @param ctx - Application context and bindings
 * @param did - User's decentralized identifier
 * @returns User document or appropriate error
 */
export function find(
  ctx: AppBindings,
  did: Did,
): E.Effect<
  UserDocument,
  DocumentNotFoundError | CollectionNotFoundError | DatabaseError
> {
  return UserRepository.findById(ctx, did);
}

/**
 * Lists all data documents owned by a user.
 *
 * Aggregates data from multiple schema collections based on
 * the user's data references.
 *
 * @param ctx - Application context and bindings
 * @param did - User's decentralized identifier
 * @returns Array of data documents owned by the user
 */
export function listUserData(
  ctx: AppBindings,
  did: Did,
): E.Effect<
  DataDocument[],
  | DocumentNotFoundError
  | CollectionNotFoundError
  | DatabaseError
  | DataValidationError
> {
  const groupBySchema = (user: UserDocument): Record<string, UUID[]> => {
    return user.data.reduce<Record<string, UUID[]>>((acc, ref) => {
      const schema = ref.schema.toString();
      if (!acc[schema]) {
        acc[schema] = [];
      }
      acc[schema].push(ref.id);
      return acc;
    }, {});
  };

  const readAllDataCollections = (
    references: Record<string, UUID[]>,
  ): E.Effect<
    DataDocument[],
    CollectionNotFoundError | DatabaseError | DataValidationError
  > => {
    return E.forEach(Object.entries(references), ([schema, ids]) =>
      DataRepository.findMany(ctx, Uuid.parse(schema), { _id: { $in: ids } }),
    ).pipe(E.map((arrays) => arrays.flat()));
  };

  return find(ctx, did).pipe(
    E.map((user) => groupBySchema(user)),
    E.flatMap((collections) => readAllDataCollections(collections)),
  );
}

/**
 * Reads permissions configured for a data document.
 *
 * @param ctx - Application context and bindings
 * @param command - Permission read command with schema and document ID
 * @returns Array of permissions for the document
 */
export function readPermissions(
  ctx: AppBindings,
  command: ReadPermissionsCommand,
): E.Effect<
  Permissions[],
  CollectionNotFoundError | DatabaseError | DataValidationError
> {
  return DataRepository.findMany(ctx, command.schema, {
    _id: command.documentId,
  }).pipe(
    E.map((documents) =>
      documents.flatMap((document) =>
        document._perms.map((perm) => new Permissions(perm.did, perm.perms)),
      ),
    ),
  );
}

/**
 * Adds new permissions to a data document.
 *
 * @param ctx - Application context and bindings
 * @param command - Permission addition command
 * @returns MongoDB update result
 */
export function addPermissions(
  ctx: AppBindings,
  command: AddPermissionsCommand,
): E.Effect<
  UpdateResult,
  CollectionNotFoundError | DatabaseError | DataValidationError
> {
  return UserRepository.addPermissions(
    ctx,
    command.schema,
    command.documentId,
    command.permissions,
  );
}

/**
 * Updates existing permissions for a data document.
 *
 * @param ctx - Application context and bindings
 * @param command - Permission update command
 * @returns MongoDB update result
 */
export function updatePermissions(
  ctx: AppBindings,
  command: UpdatePermissionsCommand,
): E.Effect<
  UpdateResult,
  CollectionNotFoundError | DatabaseError | DataValidationError
> {
  return UserRepository.updatePermissions(
    ctx,
    command.schema,
    command.documentId,
    command.permissions,
  );
}

/**
 * Deletes permissions from a data document.
 *
 * @param ctx - Application context and bindings
 * @param command - Permission deletion command
 * @returns MongoDB update result
 */
export function deletePermissions(
  ctx: AppBindings,
  command: DeletePermissionsCommand,
): E.Effect<
  UpdateResult,
  CollectionNotFoundError | DatabaseError | DataValidationError
> {
  return UserRepository.deletePermissions(
    ctx,
    command.schema,
    command.documentId,
    command.did,
  );
}
