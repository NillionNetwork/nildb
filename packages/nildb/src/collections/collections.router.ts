import * as CollectionsController from "@nildb/collections/collections.controllers";
import type { ControllerOptions } from "@nildb/common/types";

/**
 * Registers the collections domain.
 *
 * Mounts the following endpoints:
 *
 * - GET    /v1/collections                    - List all collections
 * - GET    /v1/collections/:id                - Retrieve a collection by id including metadata
 * - POST   /v1/collections                    - Create new collection with a json-schema for data validation
 * - DELETE /v1/collections/:id                - Delete collection and its data by id
 * - POST   /v1/collections/:id/indexes        - Create index on collection
 * - DELETE /v1/collections/:id/indexes/:name  - Delete an index by name
 *
 */
export function buildCollectionsRouter(options: ControllerOptions): void {
  CollectionsController.readCollections(options);
  CollectionsController.readCollectionById(options);
  CollectionsController.createCollection(options);
  CollectionsController.deleteCollectionById(options);
  CollectionsController.createCollectionIndex(options);
  CollectionsController.dropCollectionIndex(options);
}
