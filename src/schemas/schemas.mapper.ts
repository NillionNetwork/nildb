import { type IndexDirection, UUID } from "mongodb";
import type { Did } from "#/common/types";
import type {
  AddSchemaRequest,
  CreateSchemaIndexRequest,
  DeleteSchemaRequest,
  ListSchemasResponse,
  ReadSchemaMetadataResponse,
} from "#/schemas/schemas.dto";
import type {
  AddSchemaCommand,
  CreateIndexCommand,
  DeleteSchemaCommand,
  DropIndexCommand,
  SchemaDocument,
  SchemaMetadata,
} from "#/schemas/schemas.types";

/**
 * Transforms data between HTTP DTOs and domain models for schema operations.
 *
 * Centralizes all data transformations to maintain clean layer boundaries.
 * Higher layers (controllers) use these functions to convert domain
 * models to DTOs for API responses, handling field name conversions
 * and date serialization.
 */
export const SchemaDataMapper = {
  /**
   * Converts schema metadata to response DTO.
   *
   * Transforms domain model to API response format, converting dates
   * to ISO strings and mapping field names from camelCase to snake_case
   * for API consistency.
   *
   * @param metadata - Schema collection metadata domain model
   * @returns Schema metadata response DTO with serialized dates
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
   *
   * Transforms domain models to API response format, mapping field names
   * from camelCase to snake_case for consistent API contract.
   *
   * @param schemas - Array of schema documents from repository
   * @returns List schemas response DTO with field name conversions
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
   *
   * Handles DTO to domain command conversion at the boundary layer.
   *
   * @param dto - Add schema request DTO
   * @param owner - Builder DID that owns the schema
   * @returns Add schema domain command
   */
  toAddSchemaCommand(dto: AddSchemaRequest, owner: Did): AddSchemaCommand {
    return {
      _id: new UUID(dto._id),
      name: dto.name,
      schema: dto.schema,
      documentType: dto.documentType,
      owner,
    };
  },

  /**
   * Converts delete schema request DTO to domain command.
   *
   * Handles string to UUID conversion at the boundary layer.
   *
   * @param dto - Delete schema request DTO
   * @returns Delete schema domain command
   */
  toDeleteSchemaCommand(dto: DeleteSchemaRequest): DeleteSchemaCommand {
    return {
      id: new UUID(dto.id),
    };
  },

  /**
   * Converts create index request DTO to domain command.
   *
   * Handles DTO to domain command conversion with schema UUID at the boundary layer.
   *
   * @param dto - Create schema index request DTO
   * @param schema - Schema UUID for the collection
   * @returns Create index domain command
   */
  toCreateIndexCommand(
    dto: CreateSchemaIndexRequest,
    schema: UUID,
  ): CreateIndexCommand {
    // Convert keys array to Record<string, IndexDirection>
    const keys: Record<string, IndexDirection> = {};
    for (const keyObj of dto.keys) {
      for (const [field, direction] of Object.entries(keyObj)) {
        keys[field] = direction as IndexDirection;
      }
    }

    return {
      schema,
      name: dto.name,
      keys,
      unique: dto.unique,
      ttl: dto.ttl,
    };
  },

  /**
   * Converts index name to drop index command.
   *
   * Creates a command for dropping an index from a schema collection.
   *
   * @param name - Index name to drop
   * @param schema - Schema UUID for the collection
   * @returns Drop index domain command
   */
  toDropIndexCommand(name: string, schema: UUID): DropIndexCommand {
    return {
      schema,
      name,
    };
  },
};
