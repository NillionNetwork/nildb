import { Effect as E } from "effect";
import { ObjectId } from "mongodb";
import * as CollectionsService from "#/collections/collections.services";
import {
  type CollectionNotFoundError,
  type DatabaseError,
  type DataValidationError,
  type DocumentNotFoundError,
  DuplicateEntryError,
} from "#/common/errors";
import type { AppBindings } from "#/env";
import * as QueriesService from "#/queries/queries.services";
import * as BuildersRepository from "./builders.repository.js";
import type {
  AddBuilderCollectionCommand,
  AddBuilderQueryCommand,
  BuilderDocument,
  CreateBuilderCommand,
  RemoveBuilderCollectionCommand,
  RemoveBuilderQueryCommand,
  UpdateProfileCommand,
} from "./builders.types.js";

/**
 * Find builder by DID.
 */
export function find(
  ctx: AppBindings,
  did: string,
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
  if (command.did === ctx.node.did.didString) {
    return E.fail(
      new DuplicateEntryError({
        document: { name: command.name, did: command.did },
      }),
    );
  }

  const now = new Date();
  const document: BuilderDocument = {
    _id: new ObjectId(),
    did: command.did,
    _created: now,
    _updated: now,
    name: command.name,
    collections: [],
    queries: [],
  };

  return BuildersRepository.insert(ctx, document);
}

/**
 * Remove builder.
 */
export function remove(
  ctx: AppBindings,
  id: string,
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

/**
 * Add collection to builder.
 */
export function addCollection(
  ctx: AppBindings,
  command: AddBuilderCollectionCommand,
): E.Effect<
  void,
  DocumentNotFoundError | CollectionNotFoundError | DatabaseError
> {
  return BuildersRepository.addCollection(ctx, command.did, command.collection);
}

/**
 * Remove collection from builder.
 */
export function removeCollection(
  ctx: AppBindings,
  command: RemoveBuilderCollectionCommand,
): E.Effect<
  void,
  DocumentNotFoundError | CollectionNotFoundError | DatabaseError
> {
  return BuildersRepository.removeCollection(
    ctx,
    command.did,
    command.collection,
  );
}

/**
 * Add query to builder.
 */
export function addQuery(
  ctx: AppBindings,
  command: AddBuilderQueryCommand,
): E.Effect<
  void,
  DocumentNotFoundError | CollectionNotFoundError | DatabaseError
> {
  return BuildersRepository.addQuery(ctx, command.did, command.query);
}

/**
 * Remove query from builder.
 */
export function removeQuery(
  ctx: AppBindings,
  command: RemoveBuilderQueryCommand,
): E.Effect<
  void,
  DocumentNotFoundError | CollectionNotFoundError | DatabaseError
> {
  return BuildersRepository.removeQuery(ctx, command.did, command.query);
}
