import { Effect as E, pipe } from "effect";
import * as CollectionsService from "#/collections/collections.services";
import {
  type CollectionNotFoundError,
  type DatabaseError,
  type DataValidationError,
  type DocumentNotFoundError,
  DuplicateEntryError,
} from "#/common/errors";
import type { Did } from "#/common/types";
import type { AppBindings } from "#/env";
import * as QueriesService from "#/queries/queries.services";
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
  return E.all([
    BuildersRepository.deleteOneById(ctx, id),
    CollectionsService.deleteBuilderCollections(ctx, id),
    QueriesService.deleteBuilderQueries(ctx, id),
  ]);
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
