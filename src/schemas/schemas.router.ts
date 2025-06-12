import type { ControllerOptions } from "#/common/types";
import * as SchemasController from "#/schemas/schemas.controllers";

/**
 * Registers the collections domain.
 *
 * Mounts the following endpoints:
 *
 * - GET    /v1/schemas                    - List all schemas
 * - GET    /v1/schemas/:id                - Retrieve a schema by id including schema metadata
 * - POST   /v1/schemas                    - Create new JSON schema for data validation
 * - DELETE /v1/schemas/:id                - Delete schema by id
 * - POST   /v1/schemas/:id/indexes        - Create index on collection
 * - DELETE /v1/schemas/:id/indexes/:name  - Delete an index by name
 *
 */
export function buildSchemasRouter(options: ControllerOptions): void {
  SchemasController.readSchemas(options);
  SchemasController.readSchemaById(options);
  SchemasController.createSchema(options);
  SchemasController.deleteSchemaById(options);
  SchemasController.createIndex(options);
  SchemasController.dropIndex(options);
}
