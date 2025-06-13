import { Effect as E, pipe } from "effect";
import type { CreateIndexesOptions, IndexSpecification, UUID } from "mongodb";
import * as BuildersRepository from "#/builders/builders.repository";
import type { BuilderDocument } from "#/builders/builders.types";
import type {
  CollectionDocument,
  CollectionMetadata,
  CreateCollectionCommand,
  CreateIndexCommand,
  DeleteCollectionCommand,
  DropIndexCommand,
} from "#/collections/collections.types";
import type {
  CollectionNotFoundError,
  DatabaseError,
  DataValidationError,
  DocumentNotFoundError,
  IndexNotFoundError,
  InvalidIndexOptionsError,
} from "#/common/errors";
import { validateSchema } from "#/common/validator";
import * as DataRepository from "#/data/data.repository";
import type { AppBindings } from "#/env";
import * as CollectionsRepository from "./collections.repository";

/**
 * Get builder collections.
 */
export function getBuilderCollections(
  ctx: AppBindings,
  builder: BuilderDocument,
): E.Effect<
  CollectionDocument[],
  | DocumentNotFoundError
  | CollectionNotFoundError
  | DatabaseError
  | DataValidationError
> {
  return CollectionsRepository.findMany(ctx, { owner: builder._id });
}

/**
 * Add collection.
 */
export function addCollection(
  ctx: AppBindings,
  command: CreateCollectionCommand,
): E.Effect<
  void,
  | DocumentNotFoundError
  | InvalidIndexOptionsError
  | CollectionNotFoundError
  | DatabaseError
> {
  const now = new Date();
  const document: CollectionDocument = {
    _id: command.id,
    _created: now,
    _updated: now,
    name: command.name,
    schema: command.schema,
    type: command.type,
    owner: command.owner,
  };

  return pipe(
    validateSchema(command.schema),
    () => CollectionsRepository.insert(ctx, document),
    E.flatMap(() =>
      E.all([
        E.succeed(ctx.cache.builders.taint(document.owner)),
        BuildersRepository.addCollection(ctx, command.owner, document._id),
        DataRepository.createCollection(ctx, document._id),
      ]),
    ),
    E.as(void 0),
  );
}

/**
 * Delete collection.
 */
export function deleteCollection(
  ctx: AppBindings,
  command: DeleteCollectionCommand,
): E.Effect<
  void,
  | DocumentNotFoundError
  | CollectionNotFoundError
  | DatabaseError
  | DataValidationError
> {
  return pipe(
    CollectionsRepository.deleteOne(ctx, { id: command.id }),
    E.flatMap((collection) =>
      E.all([
        E.succeed(ctx.cache.builders.taint(collection.owner)),
        BuildersRepository.removeCollection(ctx, collection.owner, command.id),
        DataRepository.deleteCollection(ctx, command.id),
      ]),
    ),
    E.as(void 0),
  );
}

/**
 * Get collection metadata.
 */
export function getCollectionMetadata(
  ctx: AppBindings,
  collection: UUID,
): E.Effect<CollectionMetadata, CollectionNotFoundError | DatabaseError> {
  return pipe(CollectionsRepository.getCollectionStats(ctx, collection));
}

/**
 * Create index.
 */
export function createIndex(
  ctx: AppBindings,
  command: CreateIndexCommand,
): E.Effect<
  void,
  InvalidIndexOptionsError | CollectionNotFoundError | DatabaseError
> {
  const specification: IndexSpecification = command.keys;
  const options: CreateIndexesOptions = {
    name: command.name,
    unique: command.unique,
  };

  if (command.ttl) {
    options.expireAfterSeconds = command.ttl;
  }

  return pipe(
    CollectionsRepository.createIndex(
      ctx,
      command.collection,
      specification,
      options,
    ),
    E.as(void 0),
  );
}

/**
 * Drop index.
 */
export function dropIndex(
  ctx: AppBindings,
  command: DropIndexCommand,
): E.Effect<
  void,
  IndexNotFoundError | CollectionNotFoundError | DatabaseError
> {
  return pipe(
    CollectionsRepository.dropIndex(ctx, command.collection, command.name),
    E.as(void 0),
  );
}
