import type { ControllerOptions } from "#/common/types";
import * as SchemasController from "#/schemas/schemas.controllers";

export function buildSchemasRouter(options: ControllerOptions): void {
  SchemasController.list(options);
  SchemasController.add(options);
  SchemasController._delete(options);
  SchemasController.metadata(options);

  SchemasController.createIndex(options);
  SchemasController.dropIndex(options);
}
