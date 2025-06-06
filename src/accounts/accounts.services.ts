import { Effect as E, pipe } from "effect";
import {
  type CollectionNotFoundError,
  type DatabaseError,
  type DocumentNotFoundError,
  DuplicateEntryError,
} from "#/common/errors";
import type { Did } from "#/common/types";
import type { AppBindings } from "#/env";
import * as AccountRepository from "./accounts.repository";
import type {
  CreateAccountCommand,
  OrganizationAccountDocument,
  UpdateProfileCommand,
} from "./accounts.types";

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
 * Creates a new organisation account based on the provided command.
 *
 * Validates that the account's DID differs from the node's own DID
 * before persisting to the database. Constructs the complete document
 * from the command data.
 *
 * @param ctx - Application context containing configuration and dependencies
 * @param command - Create account command with DID and name
 * @returns Effect indicating success or relevant errors
 */
export function createAccount(
  ctx: AppBindings,
  command: CreateAccountCommand,
): E.Effect<
  void,
  DuplicateEntryError | CollectionNotFoundError | DatabaseError
> {
  return pipe(
    E.succeed(command),
    E.filterOrFail(
      (cmd) => cmd.did !== ctx.node.keypair.toDidString(),
      (cmd) =>
        new DuplicateEntryError({
          document: { name: cmd.name, did: cmd.did },
        }),
    ),
    E.map((cmd) => {
      const now = new Date();
      return {
        _id: cmd.did,
        _role: "organization" as const,
        _created: now,
        _updated: now,
        name: cmd.name,
        schemas: [],
        queries: [],
      };
    }),
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
 * Updates an organisation's profile fields based on the provided command.
 *
 * @param ctx - Application context containing configuration and dependencies
 * @param command - Update profile command with account ID and updates
 * @returns Effect indicating success or relevant errors
 */
export function updateProfile(
  ctx: AppBindings,
  command: UpdateProfileCommand,
): E.Effect<
  void,
  DocumentNotFoundError | CollectionNotFoundError | DatabaseError
> {
  return AccountRepository.update(ctx, command.accountId, command.updates);
}
