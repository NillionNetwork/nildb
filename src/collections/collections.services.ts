import { Effect as E, pipe } from "effect";
import type { CreateIndexesOptions, IndexSpecification } from "mongodb";
import * as BuildersRepository from "#/builders/builders.repository";
import type { BuilderDocument } from "#/builders/builders.types";
import type {
  CollectionDocument,
  CollectionMetadata,
  CreateCollectionCommand,
  CreateIndexCommand,
  DeleteCollectionCommand,
  DropIndexCommand,
  ReadCollectionByIdCommand,
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
  | DataValidationError
  | DocumentNotFoundError
  | InvalidIndexOptionsError
  | CollectionNotFoundError
  | DatabaseError
> {
  const now = new Date();
  const collection: CollectionDocument = {
    _id: command._id,
    _created: now,
    _updated: now,
    name: command.name,
    schema: command.schema,
    type: command.type,
    owner: command.owner,
  };

  return pipe(
    validateSchema(command.schema),
    E.flatMap(() => CollectionsRepository.insert(ctx, collection)),
    E.map(() => ctx.cache.builders.taint(collection.owner)),
    E.flatMap(() =>
      BuildersRepository.addCollection(ctx, command.owner, collection._id),
    ),
    E.flatMap(() => DataRepository.createCollection(ctx, collection._id)),
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
    CollectionsRepository.deleteOne(ctx, { _id: command._id }),
    E.flatMap((collection) =>
      E.all([
        E.succeed(ctx.cache.builders.taint(collection.owner)),
        BuildersRepository.removeCollection(ctx, collection.owner, command._id),
        DataRepository.deleteCollection(ctx, command._id),
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
  command: ReadCollectionByIdCommand,
): E.Effect<CollectionMetadata, CollectionNotFoundError | DatabaseError> {
  return CollectionsRepository.getCollectionStats(ctx, command.id);
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
