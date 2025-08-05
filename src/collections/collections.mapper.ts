import { type IndexDirection, UUID } from "mongodb";
import type { Did } from "#/common/types";
import type {
  CreateCollectionIndexRequest,
  CreateCollectionRequest,
  DeleteCollectionRequestParams,
  DropCollectionIndexParams,
  ListCollectionsResponse,
  ReadCollectionMetadataRequestParams,
  ReadCollectionMetadataResponse,
} from "./collections.dto";
import type {
  CollectionDocument,
  CollectionMetadata,
  CreateCollectionCommand,
  CreateIndexCommand,
  DeleteCollectionCommand,
  DropIndexCommand,
  ReadCollectionByIdCommand,
} from "./collections.types";

export const CollectionsDataMapper = {
  /**
   *
   */
  toReadMetadataResponse(
    metadata: CollectionMetadata,
  ): ReadCollectionMetadataResponse {
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
   *
   */
  toListCollectionsResponse(
    collections: CollectionDocument[],
  ): ListCollectionsResponse {
    return {
      data: collections.map((collection) => ({
        id: collection._id.toString(),
        name: collection.name,
        type: collection.type,
      })),
    };
  },

  /**
   *
   */
  toCreateCollectionCommand(
    body: CreateCollectionRequest,
    owner: Did,
  ): CreateCollectionCommand {
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
  toDeleteCollectionCommand(
    dto: DeleteCollectionRequestParams,
  ): DeleteCollectionCommand {
    return {
      _id: new UUID(dto.id),
    };
  },

  /**
   *
   */
  toCreateIndexCommand(dto: CreateCollectionIndexRequest): CreateIndexCommand {
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
    };
  },

  /**
   *
   */
  toDropIndexCommand(body: DropCollectionIndexParams): DropIndexCommand {
    return {
      collection: new UUID(body.id),
      name: body.name,
    };
  },

  /**
   *
   */
  toReadCollectionById(
    params: ReadCollectionMetadataRequestParams,
  ): ReadCollectionByIdCommand {
    return {
      id: new UUID(params.id),
    };
  },
};
