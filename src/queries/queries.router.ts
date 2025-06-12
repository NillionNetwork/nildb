import type { ControllerOptions } from "#/common/types";
import * as QueriesController from "#/queries/queries.controllers";

/**
 * Registers the queries domain.
 *
 * - GET    /v1/queries               - List all queries
 * - GET    /v1/queries/:id           - Retrieve a query by id
 * - POST   /v1/queries               - Create new aggregation query
 * - DELETE /v1/queries/:id           - Delete the specified query
 * - POST   /v1/queries/run           - Run query in background (returns run id)
 * - GET    /v1/queries/run/:id       - Get query run results by id
 *
 */
export function buildQueriesRouter(options: ControllerOptions): void {
  QueriesController.readQueries(options);
  QueriesController.readQueryById(options);
  QueriesController.createQuery(options);
  QueriesController.deleteQuery(options);
  QueriesController.runQuery(options);
  QueriesController.getQueryRunResultById(options);
}
