import { Did } from "@nillion/nuc";
import { bytesToHex } from "@noble/hashes/utils.js";
import { Effect as E, pipe } from "effect";
import { ObjectId } from "mongodb";
import * as CollectionsService from "#/collections/collections.services";
import {
  type CollectionNotFoundError,
  type DatabaseError,
  DataValidationError,
  type DocumentNotFoundError,
  DuplicateEntryError,
} from "#/common/errors";
import type { AppBindings } from "#/env";
import * as QueriesService from "#/queries/queries.services";
import * as BuildersRepository from "./builders.repository";
import type {
  AddBuilderCollectionCommand,
  AddBuilderQueryCommand,
  BuilderDocument,
  CreateBuilderCommand,
  RemoveBuilderCollectionCommand,
  RemoveBuilderQueryCommand,
  UpdateProfileCommand,
} from "./builders.types";

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
  | DataValidationError
  | DuplicateEntryError
  | CollectionNotFoundError
  | DatabaseError
> {
  return pipe(
    E.Do,
    E.bind("normalizedDid", () =>
      E.try({
        try: () => {
          const inputDid = command.did;
          const validatedDid = Did.parse(inputDid);
          // if its did:nil convert to did:key for db consistency
          if (validatedDid.method === "nil") {
            const publicKey = bytesToHex(validatedDid.publicKeyBytes);
            return Did.fromPublicKey(publicKey);
          }
          return validatedDid;
        },
        catch: (cause) =>
          new DataValidationError({
            issues: [`Invalid Did format: ${command.did}`],
            cause,
          }),
      }),
    ),
    E.tap(({ normalizedDid }) =>
      E.filterOrFail(
        () => normalizedDid.didString !== ctx.node.did.didString,
        () =>
          new DuplicateEntryError({
            document: { name: command.name, did: normalizedDid.didString },
          }),
      ),
    ),
    E.map(({ normalizedDid }) => {
      const now = new Date();
      return {
        _id: new ObjectId(),
        did: normalizedDid.didString,
        _created: now,
        _updated: now,
        name: command.name,
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
