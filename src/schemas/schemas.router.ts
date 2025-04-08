import {} from "http-status-codes";
import * as SchemasController from "#/schemas/schemas.controllers";
import type { ControllerOptions } from "#/common/types";

export function buildSchemasRouter(options: ControllerOptions): void {
  SchemasController.list(options);
  SchemasController.add(options);
  SchemasController.remove(options);
  SchemasController.metadata(options);

  SchemasController.createIndex(options);
  SchemasController.dropIndex(options);
}
