import type { ControllerOptions } from "#/common/types";
import * as QueriesController from "#/queries/queries.controllers";

export function buildQueriesRouter(options: ControllerOptions): void {
  QueriesController.add(options);
  QueriesController._delete(options);
  QueriesController.execute(options);
  QueriesController.list(options);
  QueriesController.getQueryJob(options);
}
