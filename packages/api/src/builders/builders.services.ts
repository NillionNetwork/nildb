import * as CollectionsService from "@nildb/collections/collections.services";
import {
  type CollectionNotFoundError,
  type DatabaseError,
  type DataValidationError,
  type DocumentNotFoundError,
  DuplicateEntryError,
  InvalidDidError,
} from "@nildb/common/errors";
import type { AppBindings } from "@nildb/env";
import * as QueriesService from "@nildb/queries/queries.services";
import { Effect as E } from "effect";
import { ObjectId } from "mongodb";

import * as BuildersRepository from "./builders.repository";
import type { BuilderDocument, CreateBuilderCommand, UpdateProfileCommand } from "./builders.types";

/**
 * Find builder by DID.
 */
export function find(
  ctx: AppBindings,
  did: string,
): E.Effect<BuilderDocument, DocumentNotFoundError | CollectionNotFoundError | DatabaseError> {
  return BuildersRepository.findOne(ctx, did);
}

/**
 * Create new builder.
 */
export function createBuilder(
  ctx: AppBindings,
  command: CreateBuilderCommand,
): E.Effect<void, DuplicateEntryError | InvalidDidError | CollectionNotFoundError | DatabaseError> {
  if (command.did === ctx.node.did.didString) {
    return E.fail(
      new DuplicateEntryError({
        document: { name: command.name, did: command.did },
      }),
    );
  }

  if (!command.did.startsWith("did:ethr:") && !command.did.startsWith("did:key:")) {
    return E.fail(
      new InvalidDidError({
        message: "Registration requires did:ethr or did:key",
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
    creditsUsd: 0,
  };

  return BuildersRepository.insert(ctx, document);
}

/**
 * Remove builder.
 */
export function remove(
  ctx: AppBindings,
  id: string,
): E.Effect<void, DocumentNotFoundError | CollectionNotFoundError | DatabaseError | DataValidationError> {
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
): E.Effect<void, DocumentNotFoundError | CollectionNotFoundError | DatabaseError> {
  return BuildersRepository.update(ctx, command.builder, command.updates);
}
