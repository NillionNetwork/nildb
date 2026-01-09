import { type IndexDirection, UUID } from "mongodb";

import type {
  CreateCollectionIndexRequest,
  CreateCollectionRequest,
  DeleteCollectionRequestParams,
  DropCollectionIndexParams,
  ListCollectionsResponse,
  Paginated,
  ReadCollectionMetadataRequestParams,
  ReadCollectionMetadataResponse,
} from "@nillion/nildb-types";

import type {
  CollectionDocument,
  CollectionMetadata,
  CreateCollectionCommand,
  CreateIndexCommand,
  DeleteCollectionCommand,
  DropIndexCommand,
  ReadCollectionByIdCommand,
} from "./collections.types.js";

export const CollectionsDataMapper = {
  /**
   *
   */
  toReadMetadataResponse(metadata: CollectionMetadata): ReadCollectionMetadataResponse {
    return {
      data: {
        _id: metadata._id.toString(),
        count: metadata.count,
        size: metadata.size,
        first_write: metadata.firstWrite.toISOString(),
        last_write: metadata.lastWrite.toISOString(),
        indexes: metadata.indexes.map((index) => ({
          v: index.v,
          key: index.key,
          name: index.name,
          unique: index.unique,
        })),
        schema: metadata.schema,
      },
    };
  },

  /**
   * Converts a paginated collection result into a paginated Api response.
   *
   * @param paginatedResult The paginated data from the service layer.
   * @returns The final Api response object for listing collections.
   */
  toListCollectionsResponse(paginatedResult: Paginated<CollectionDocument>): ListCollectionsResponse {
    return {
      data: paginatedResult.data.map((collection) => ({
        id: collection._id.toString(),
        name: collection.name,
        type: collection.type,
      })),
      pagination: {
        total: paginatedResult.total,
        limit: paginatedResult.limit,
        offset: paginatedResult.offset,
        sort: paginatedResult.sort,
      },
    };
  },

  /**
   *
   */
  toCreateCollectionCommand(body: CreateCollectionRequest, owner: string): CreateCollectionCommand {
    return {
      _id: new UUID(body._id),
      name: body.name,
      schema: body.schema,
      type: body.type,
      owner,
    };
  },

  /**
   *
   */
  toDeleteCollectionCommand(dto: DeleteCollectionRequestParams, requesterId: string): DeleteCollectionCommand {
    return {
      _id: new UUID(dto.id),
      requesterId,
    };
  },

  /**
   *
   */
  toCreateIndexCommand(dto: CreateCollectionIndexRequest, requesterId: string): CreateIndexCommand {
    // Convert keys array to Record<string, IndexDirection>
    const keys: Record<string, IndexDirection> = {};
    for (const keyObj of dto.keys) {
      for (const [field, direction] of Object.entries(keyObj)) {
        keys[field] = direction as IndexDirection;
      }
    }

    return {
      collection: new UUID(dto.collection),
      name: dto.name,
      keys,
      unique: dto.unique,
      ttl: dto.ttl,
      requesterId,
    };
  },

  /**
   *
   */
  toDropIndexCommand(body: DropCollectionIndexParams, requesterId: string): DropIndexCommand {
    return {
      collection: new UUID(body.id),
      name: body.name,
      requesterId,
    };
  },

  /**
   *
   */
  toReadCollectionById(params: ReadCollectionMetadataRequestParams, requesterId: string): ReadCollectionByIdCommand {
    return {
      id: new UUID(params.id),
      requesterId,
    };
  },
};
