import { Effect as E, pipe } from "effect";
import type { CreateIndexesOptions, IndexSpecification } from "mongodb";
import * as BuildersRepository from "#/builders/builders.repository";
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
import type { Did } from "#/common/types";
import { validateSchema } from "#/common/validator";
import * as DataRepository from "#/data/data.repository";
import * as DataService from "#/data/data.services";
import type { AppBindings } from "#/env";
import * as CollectionsRepository from "./collections.repository";

/**
 * Get builder collections.
 */
export function getBuilderCollections(
  ctx: AppBindings,
  id: Did,
): E.Effect<
  CollectionDocument[],
  | DocumentNotFoundError
  | CollectionNotFoundError
  | DatabaseError
  | DataValidationError
> {
  return CollectionsRepository.findMany(ctx, { owner: id });
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
    E.tap((collection) => ctx.cache.builders.taint(collection.owner)),
    E.flatMap((collection) =>
      E.all([
        BuildersRepository.removeCollection(ctx, collection.owner, command._id),
        DataService.deleteCollection(ctx, collection._id),
      ]),
    ),
    E.as(void 0),
  );
}

/**
 * Delete builder collections.
 */
export function deleteBuilderCollections(
  ctx: AppBindings,
  builder: Did,
): E.Effect<
  void,
  | DocumentNotFoundError
  | CollectionNotFoundError
  | DatabaseError
  | DataValidationError
> {
  return pipe(
    getBuilderCollections(ctx, builder),
    E.tap(() => ctx.cache.builders.taint(builder)),
    E.flatMap((collections) =>
      E.forEach(collections, (collection) =>
        DataService.deleteCollection(ctx, collection._id),
      ),
    ),
    E.flatMap(() => CollectionsRepository.deleteMany(ctx, { owner: builder })),
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
