import { Effect as E, pipe } from "effect";
import {
  type CollectionNotFoundError,
  type DatabaseError,
  type DocumentNotFoundError,
  DuplicateEntryError,
} from "#/common/errors";
import type { Did } from "#/common/types";
import type { AppBindings } from "#/env";
import type { OrganizationAccountDocument } from "./accounts.mapper";
import * as AccountRepository from "./accounts.repository";

/**
 * Retrieves an organisation account by DID.
 *
 * @param ctx - Application context containing configuration and dependencies
 * @param did - Decentralised identifier of the account to retrieve
 * @returns Effect containing the account document or relevant errors
 */
export function find(
  ctx: AppBindings,
  did: Did,
): E.Effect<
  OrganizationAccountDocument,
  DocumentNotFoundError | CollectionNotFoundError | DatabaseError
> {
  return AccountRepository.findOneOrganization(ctx, did);
}

/**
 * Creates a new organisation account.
 *
 * Validates that the account's DID differs from the node's own DID
 * before persisting to the database.
 *
 * @param ctx - Application context containing configuration and dependencies
 * @param account - Complete account document to create
 * @returns Effect indicating success or relevant errors
 */
export function createAccount(
  ctx: AppBindings,
  account: OrganizationAccountDocument,
): E.Effect<
  void,
  DuplicateEntryError | CollectionNotFoundError | DatabaseError
> {
  return pipe(
    E.succeed(account),
    E.filterOrFail(
      (document) => document._id !== ctx.node.keypair.toDidString(),
      (document) =>
        new DuplicateEntryError({
          document: { name: document.name, did: document._id },
        }),
    ),
    E.flatMap((document) => AccountRepository.insert(ctx, document)),
  );
}

/**
 * Removes an organisation account permanently.
 *
 * @param ctx - Application context containing configuration and dependencies
 * @param id - DID of the account to delete
 * @returns Effect indicating success or relevant errors
 */
export function remove(
  ctx: AppBindings,
  id: Did,
): E.Effect<
  void,
  DocumentNotFoundError | CollectionNotFoundError | DatabaseError
> {
  return AccountRepository.deleteOneById(ctx, id);
}

/**
 * Updates an organisation's profile fields.
 *
 * @param ctx - Application context containing configuration and dependencies
 * @param id - DID of the account to update
 * @param updates - Partial object containing fields to update
 * @returns Effect indicating success or relevant errors
 */
export function updateProfile(
  ctx: AppBindings,
  id: Did,
  updates: Partial<{ _id: Did; name: string }>,
): E.Effect<
  void,
  DocumentNotFoundError | CollectionNotFoundError | DatabaseError
> {
  return AccountRepository.update(ctx, id, updates);
}
