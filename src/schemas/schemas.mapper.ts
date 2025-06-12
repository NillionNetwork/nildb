import { type IndexDirection, UUID } from "mongodb";
import type { Did } from "#/common/types";
import type {
  CreateSchemaIndexRequest,
  CreateSchemaRequest,
  DeleteSchemaRequestParams,
  ListSchemasResponse,
  ReadSchemaMetadataResponse,
} from "#/schemas/schemas.dto";
import type {
  CreateIndexCommand,
  CreateSchemaCommand,
  DeleteSchemaCommand,
  DropIndexCommand,
  SchemaDocument,
  SchemaMetadata,
} from "#/schemas/schemas.types";

export const SchemaDataMapper = {
  /**
   * Converts schema metadata to response DTO.
   */
  toReadMetadataResponse(metadata: SchemaMetadata): ReadSchemaMetadataResponse {
    return {
      data: {
        id: metadata.id.toString(),
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
      },
    };
  },

  /**
   * Converts array of schema documents to list response DTO.
   */
  toListSchemasResponse(schemas: SchemaDocument[]): ListSchemasResponse {
    return {
      data: schemas.map((schema) => ({
        owner: schema.owner,
        name: schema.name,
        schema: schema.schema,
        document_type: schema.documentType,
      })),
    };
  },

  /**
   * Converts add schema request DTO to domain command.
   */
  toCreateSchemaCommand(
    dto: CreateSchemaRequest,
    owner: Did,
  ): CreateSchemaCommand {
    return {
      _id: new UUID(dto._id),
      name: dto.name,
      schema: dto.schema,
      documentType: dto.documentType,
      owner,
    };
  },

  /**
   * Converts delete schema request params to domain command.
   */
  toDeleteSchemaCommand(dto: DeleteSchemaRequestParams): DeleteSchemaCommand {
    return {
      id: new UUID(dto.id),
    };
  },

  /**
   * Converts create index request DTO to domain command.
   */
  toCreateIndexCommand(dto: CreateSchemaIndexRequest): CreateIndexCommand {
    // Convert keys array to Record<string, IndexDirection>
    const keys: Record<string, IndexDirection> = {};
    for (const keyObj of dto.keys) {
      for (const [field, direction] of Object.entries(keyObj)) {
        keys[field] = direction as IndexDirection;
      }
    }

    return {
      schema: new UUID(dto.schema),
      name: dto.name,
      keys,
      unique: dto.unique,
      ttl: dto.ttl,
    };
  },

  /**
   * Converts index name to drop index command.
   */
  toDropIndexCommand(name: string, schema: UUID): DropIndexCommand {
    return {
      schema,
      name,
    };
  },
};
