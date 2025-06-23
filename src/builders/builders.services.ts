import { Effect as E, pipe } from "effect";
import * as CollectionsRepository from "#/collections/collections.repository";
import {
  type CollectionNotFoundError,
  type DatabaseError,
  type DataValidationError,
  type DocumentNotFoundError,
  DuplicateEntryError,
} from "#/common/errors";
import type { Did } from "#/common/types";
import * as DataRepository from "#/data/data.repository";
import type { AppBindings } from "#/env";
import * as QueriesRepository from "#/queries/queries.repository";
import * as UserRepository from "#/users/users.repository";
import * as BuildersRepository from "./builders.repository";
import type {
  BuilderDocument,
  CreateBuilderCommand,
  UpdateProfileCommand,
} from "./builders.types";

/**
 * Find builder by DID.
 */
export function find(
  ctx: AppBindings,
  did: Did,
): E.Effect<
  BuilderDocument,
  DocumentNotFoundError | CollectionNotFoundError | DatabaseError
> {
  return BuildersRepository.findOne(ctx, did);
}

/**
 * Create new builder.
 */
export function createBuilder(
  ctx: AppBindings,
  command: CreateBuilderCommand,
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
        _created: now,
        _updated: now,
        name: cmd.name,
        collections: [],
        queries: [],
      };
    }),
    E.flatMap((document) => BuildersRepository.insert(ctx, document)),
  );
}

/**
 * Remove builder.
 */
export function remove(
  ctx: AppBindings,
  id: Did,
): E.Effect<
  void,
  | DocumentNotFoundError
  | CollectionNotFoundError
  | DatabaseError
  | DataValidationError
> {
  return BuildersRepository.findOne(ctx, id).pipe(
    E.flatMap((document) =>
      E.all([
        BuildersRepository.deleteOneById(ctx, id),
        CollectionsRepository.deleteMany(ctx, {
          _id: { $in: document.collections },
        }),
        QueriesRepository.deleteMany(ctx, { _id: { $in: document.queries } }),
        E.forEach(document.collections, (collectionId) =>
          pipe(
            // This deletes the owned documents from the users, the standard documents are skipped.
            UserRepository.deleteUserDataReferences(ctx, collectionId, {}),
            E.flatMap(() => DataRepository.deleteCollection(ctx, collectionId)),
          ),
        ),
      ]),
    ),
    E.as(void 0),
  );
}

/**
 * Update builder profile.
 */
export function updateProfile(
  ctx: AppBindings,
  command: UpdateProfileCommand,
): E.Effect<
  void,
  DocumentNotFoundError | CollectionNotFoundError | DatabaseError
> {
  return BuildersRepository.update(ctx, command.builder, command.updates);
}
