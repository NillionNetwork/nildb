import type { ControllerOptions } from "@nildb/common/types";

import * as DataController from "./data.controllers.js";

/**
 * Registers all data-related routes with the application.
 *
 * Mounts the following endpoints:
 * - POST   /v1/data/find           - Find documents that match a given filter
 * - POST   /v1/data/update         - Update documents that match the given filter
 * - POST   /v1/data/delete         - Delete documents that match the given filter
 * - DELETE /v1/data/:id/drop       - Drop all documents in the collection
 * - GET    /v1/data/:id/recent     - Return recent records
 * - POST   /v1/data/owned          - Create owned records
 * - POST   /v1/data/standard       - Create standard records
 *
 * All endpoints require authentication via NUC tokens. Data endpoints work with
 * schema-validated collections and support different access patterns based on
 * data ownership (owned vs standard).
 *
 * @param options - Controller configuration including app instance and bindings
 */
export function buildDataRouter(options: ControllerOptions): void {
  DataController.findData(options);
  DataController.updateData(options);
  DataController.deleteData(options);
  DataController.flushData(options);
  DataController.tailData(options);
  DataController.createOwnedData(options);
  DataController.createStandardData(options);
}
