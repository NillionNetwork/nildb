import { Effect as E, pipe } from "effect";
import type { UpdateResult } from "mongodb";
import type {
  CollectionNotFoundError,
  DatabaseError,
  DataValidationError,
  DocumentNotFoundError,
} from "#/common/errors";
import type { Did } from "#/common/types";
import type { AppBindings } from "#/env";
import * as UserRepository from "./users.repository";
import type {
  DataDocumentReference,
  GrantAccessToDataCommand,
  RevokeAccessToDataCommand,
  UserDocument,
} from "./users.types";

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
/**
 * List user data references.
 */
export function listUserDataReferences(
  ctx: AppBindings,
  did: Did,
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
  CollectionNotFoundError | DatabaseError | DataValidationError
> {
  return UserRepository.addAclEntry(
    ctx,
    command.collection,
    command.document,
    command.owner,
    command.acl,
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
  CollectionNotFoundError | DatabaseError | DataValidationError
> {
  return UserRepository.removeAclEntry(
    ctx,
    command.collection,
    command.document,
    command.grantee,
    command.owner,
  );
}
