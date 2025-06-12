import { Effect as E, pipe } from "effect";
import {
  type CollectionNotFoundError,
  type DatabaseError,
  type DocumentNotFoundError,
  DuplicateEntryError,
} from "#/common/errors";
import type { Did } from "#/common/types";
import type { AppBindings } from "#/env";
import * as BuilderRepository from "./builders.repository";
import type {
  BuilderDocument,
  CreateBuilderCommand,
  UpdateProfileCommand,
} from "./builders.types";

/**
 * Retrieves an organisation builder by DID.
 */
export function find(
  ctx: AppBindings,
  did: Did,
): E.Effect<
  BuilderDocument,
  DocumentNotFoundError | CollectionNotFoundError | DatabaseError
> {
  return BuilderRepository.findOne(ctx, did);
}

/**
 * Creates a new organisation builder based on the provided command.
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
    E.flatMap((document) => BuilderRepository.insert(ctx, document)),
  );
}

/**
 * Removes an organisation builder permanently.
 */
export function remove(
  ctx: AppBindings,
  id: Did,
): E.Effect<
  void,
  DocumentNotFoundError | CollectionNotFoundError | DatabaseError
> {
  return BuilderRepository.deleteOneById(ctx, id);
}

/**
 * Updates an organisation's profile fields based on the provided command.
 */
export function updateProfile(
  ctx: AppBindings,
  command: UpdateProfileCommand,
): E.Effect<
  void,
  DocumentNotFoundError | CollectionNotFoundError | DatabaseError
> {
  return BuilderRepository.update(ctx, command.builder, command.updates);
}
