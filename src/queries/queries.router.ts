import * as QueriesController from "#/queries/queries.controllers";
import type { ControllerOptions } from "#/common/types";

export function buildQueriesRouter(options: ControllerOptions): void {
  QueriesController.add(options);
  QueriesController.remove(options);
  QueriesController.execute(options);
  QueriesController.list(options);
}
