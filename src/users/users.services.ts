import { Effect as E, pipe } from "effect";
import type { UpdateResult, UUID } from "mongodb";
import * as CollectionsService from "#/collections/collections.services";
import { enforceDataOwnership } from "#/common/acl";
import {
  type CollectionNotFoundError,
  type DatabaseError,
  DataValidationError,
  type DocumentNotFoundError,
  GrantAccessError,
  type ResourceAccessDeniedError,
} from "#/common/errors";
import * as DataRepository from "#/data/data.repository";
import type { AppBindings } from "#/env";
import { UserDataMapper, UserLoggerMapper } from "#/users/users.mapper";
import * as UserRepository from "./users.repository";
import type {
  DataDocumentReference,
  GrantAccessToDataCommand,
  RevokeAccessToDataCommand,
  UpsertUserCommand,
  UserDocument,
} from "./users.types";

/**
 * Update or create a user document in the database.
 *
 * This function will either update an existing user document
 * or create a new one if it does not exist.
 * It will also update the user's data references
 * and access control list (ACL) if provided.
 *
 * @param ctx - Application context and bindings
 * @param command - Command containing user data and ACL
 * @returns Effect that resolves to void or an error
 */
export function upsertUser(
  ctx: AppBindings,
  command: UpsertUserCommand,
): E.Effect<
  void,
  CollectionNotFoundError | DatabaseError | DataValidationError
> {
  return UserRepository.upsert(ctx, command.user, command.data, command.acl);
}

/**
 * Updates user data logs based on the provided filter.
 *
 * This function retrieves all documents that match the filter,
 * groups them by owner, and updates the user logs
 * for each owner with the document IDs.
 *
 * @param ctx - Application context and bindings
 * @param collection - UUID of the collection to search in
 * @param filter - Filter to find owned documents
 * @return Effect that resolves to void or an error
 */
export function updateUserData(
  ctx: AppBindings,
  collection: UUID,
  filter: Record<string, unknown>,
): E.Effect<
  void,
  CollectionNotFoundError | DatabaseError | DataValidationError
> {
  return pipe(
    DataRepository.findAll(ctx, collection, {
      ...filter,
      _owner: { $exists: true },
    }),
    // This returns the owned documents grouped by owner, the standard documents are skipped.
    E.map((documents) => UserDataMapper.groupByOwner(documents)),
    E.flatMap((documents) =>
      E.forEach(Object.entries(documents), ([owner, ids]) =>
        UserRepository.updateUserLogs(
          ctx,
          owner,
          UserLoggerMapper.toUpdateDataLogs(ids),
        ),
      ),
    ),
  );
}

/**
 * Retrieves a user document by DID.
 *
 * @param ctx - Application context and bindings
 * @param did - User's decentralized identifier
 * @returns User document or appropriate error
 */
/**
 * Find user.
 */
export function find(
  ctx: AppBindings,
  did: string,
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
export function listUserDataReferences(
  ctx: AppBindings,
  did: string,
): E.Effect<
  DataDocumentReference[],
  | DocumentNotFoundError
  | CollectionNotFoundError
  | DatabaseError
  | DataValidationError
> {
  return pipe(
    find(ctx, did),
    E.map((user) => user.data),
  );
}

/**
 * Deletes data documents owned by a user.
 *
 * This function finds all documents that the user owns and removes them
 * from the database. It also removes the user from the user repository
 * if they have no remaining data.
 *
 * @param ctx - Application context and bindings
 * @param collection - Collection UUID
 * @param filter - Filter to find owned documents
 * @returns Effect that resolves to void or an error
 */
export function deleteUserDataReferences(
  ctx: AppBindings,
  collection: UUID,
  filter: Record<string, unknown>,
): E.Effect<
  void,
  CollectionNotFoundError | DatabaseError | DataValidationError,
  never
> {
  return pipe(
    DataRepository.findAll(ctx, collection, {
      ...filter,
      _owner: { $exists: true },
    }),
    // This returns the owned documents grouped by owner, the standard documents are skipped.
    E.map((documents) => UserDataMapper.groupByOwner(documents)),
    E.flatMap((documents) =>
      E.forEach(Object.entries(documents), ([owner, ids]) =>
        pipe(
          UserRepository.removeData(ctx, owner, ids),
          E.flatMap(() =>
            UserRepository.removeUser(ctx, { _id: owner, data: { $size: 0 } }),
          ),
        ),
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
/**
 * Grant user access.
 */
export function grantAccess(
  ctx: AppBindings,
  command: GrantAccessToDataCommand,
): E.Effect<
  UpdateResult,
  | CollectionNotFoundError
  | DatabaseError
  | DataValidationError
  | DocumentNotFoundError
  | GrantAccessError
  | ResourceAccessDeniedError
> {
  const { owner, collection, document, acl } = command;

  // Validate that at least one permission is true
  if (!acl.read && !acl.write && !acl.execute) {
    return E.fail(
      new GrantAccessError({
        type: "document",
        id: document.toString(),
        acl,
      }),
    );
  }

  const logs = [UserLoggerMapper.toGrantAccessLog(collection, acl)];
  return pipe(
    find(ctx, owner),
    E.tap((user) => enforceDataOwnership(user, document, collection)),
    E.flatMap(() => UserRepository.updateUserLogs(ctx, owner, logs)),
    E.flatMap(() =>
      UserRepository.addAclEntry(ctx, collection, document, owner, acl),
    ),
  );
}

/**
 * Deletes permissions from a data document.
 *
 * @param ctx - Application context and bindings
 * @param command - Permission deletion command
 * @returns MongoDB update result
 */
/**
 * Revoke user access.
 */
export function revokeAccess(
  ctx: AppBindings,
  command: RevokeAccessToDataCommand,
): E.Effect<
  UpdateResult,
  | CollectionNotFoundError
  | DatabaseError
  | DataValidationError
  | DocumentNotFoundError
  | ResourceAccessDeniedError
> {
  const { owner, collection, document, grantee } = command;
  const logs = [UserLoggerMapper.toRevokeAccessLog(collection, grantee)];
  return pipe(
    E.Do,
    E.bind("user", () => find(ctx, owner)),
    E.bind("collectionDoc", () =>
      CollectionsService.find(ctx, { _id: collection }),
    ),
    E.tap(({ user }) => enforceDataOwnership(user, document, collection)),
    E.filterOrFail(
      ({ collectionDoc }) => collectionDoc.owner !== grantee,
      () =>
        new DataValidationError({
          issues: [
            "Collection owners cannot have their access revoked. To remove data, the data owner must delete it.",
          ],
          cause: { collection, grantee },
        }),
    ),
    E.flatMap(() => UserRepository.updateUserLogs(ctx, owner, logs)),
    E.flatMap(() =>
      UserRepository.removeAclEntry(ctx, collection, document, grantee, owner),
    ),
  );
}
