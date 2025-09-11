import { Effect as E, pipe } from "effect";
import type { CreateIndexesOptions, IndexSpecification } from "mongodb";
import * as BuildersService from "#/builders/builders.services";
import type {
  CollectionDocument,
  CollectionMetadata,
  CreateCollectionCommand,
  CreateIndexCommand,
  DeleteCollectionCommand,
  DropIndexCommand,
  ReadCollectionByIdCommand,
} from "#/collections/collections.types";
import { enforceBuilderOwnership } from "#/common/acl";
import type {
  CollectionNotFoundError,
  DatabaseError,
  DataValidationError,
  DocumentNotFoundError,
  IndexNotFoundError,
  InvalidIndexOptionsError,
  ResourceAccessDeniedError,
} from "#/common/errors";
import { validateSchema } from "#/common/validator";
import * as DataService from "#/data/data.services";
import type { AppBindings } from "#/env";
import * as CollectionsRepository from "./collections.repository";

/**
 * Get builder collections.
 */
export function getBuilderCollections(
  ctx: AppBindings,
  id: string,
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
      BuildersService.addCollection(ctx, {
        did: collection.owner,
        collection: command._id,
      }),
    ),
    E.flatMap(() => DataService.create(ctx, collection._id)),
    E.as(void 0),
  );
}

/**
 * Find a collection
 */
export function find(
  ctx: AppBindings,
  filter: Record<string, unknown>,
): E.Effect<
  CollectionDocument,
  | DocumentNotFoundError
  | CollectionNotFoundError
  | DatabaseError
  | DataValidationError
> {
  return CollectionsRepository.findOne(ctx, filter);
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
  | ResourceAccessDeniedError
> {
  return pipe(
    CollectionsRepository.findOne(ctx, { _id: command._id }),
    E.tap((collection) =>
      enforceBuilderOwnership(
        command.requesterId,
        collection.owner,
        "collection",
        command._id,
      ),
    ),
    E.flatMap(() => CollectionsRepository.deleteOne(ctx, { _id: command._id })),
    E.tap((collection) => ctx.cache.builders.taint(collection.owner)),
    E.flatMap((collection) =>
      E.all([
        BuildersService.removeCollection(ctx, {
          did: collection.owner,
          collection: command._id,
        }),
        DataService.drop(ctx, collection._id),
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
  builder: string,
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
        DataService.drop(ctx, collection._id),
      ),
    ),
    E.flatMap(() => CollectionsRepository.deleteMany(ctx, { owner: builder })),
  );
}

/**
 * Get collection metadata.
 */
export function getCollectionById(
  ctx: AppBindings,
  command: ReadCollectionByIdCommand,
): E.Effect<
  CollectionMetadata,
  | DocumentNotFoundError
  | CollectionNotFoundError
  | DatabaseError
  | DataValidationError
  | ResourceAccessDeniedError
> {
  return pipe(
    E.Do,
    E.bind("collection", () =>
      CollectionsRepository.findOne(ctx, { _id: command.id }),
    ),
    E.tap(({ collection }) =>
      enforceBuilderOwnership(
        command.requesterId,
        collection.owner,
        "collection",
        command.id,
      ),
    ),
    E.bind("metadata", () =>
      CollectionsRepository.getCollectionStats(ctx, command.id),
    ),
    E.map(({ collection, metadata }) => ({
      ...metadata,
      schema: collection.schema,
    })),
  );
}

/**
 * Create index.
 */
export function createIndex(
  ctx: AppBindings,
  command: CreateIndexCommand,
): E.Effect<
  void,
  | InvalidIndexOptionsError
  | CollectionNotFoundError
  | DatabaseError
  | DocumentNotFoundError
  | DataValidationError
  | ResourceAccessDeniedError
> {
  return pipe(
    CollectionsRepository.findOne(ctx, { _id: command.collection }),
    E.tap((collection) =>
      enforceBuilderOwnership(
        command.requesterId,
        collection.owner,
        "collection",
        command.collection,
      ),
    ),
    E.flatMap((collection) => {
      const specification: IndexSpecification = command.keys;
      const options: CreateIndexesOptions = {
        name: command.name,
        unique: command.unique,
      };

      if (command.ttl) {
        options.expireAfterSeconds = command.ttl;
      }

      return CollectionsRepository.createIndex(
        ctx,
        collection._id,
        specification,
        options,
      );
    }),
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
  | IndexNotFoundError
  | CollectionNotFoundError
  | DatabaseError
  | DocumentNotFoundError
  | DataValidationError
  | ResourceAccessDeniedError
> {
  return pipe(
    CollectionsRepository.findOne(ctx, { _id: command.collection }),
    E.tap((collection) =>
      enforceBuilderOwnership(
        command.requesterId,
        collection.owner,
        "collection",
        command.collection,
      ),
    ),
    E.flatMap((collection) =>
      CollectionsRepository.dropIndex(ctx, collection._id, command.name),
    ),
    E.as(void 0),
  );
}
