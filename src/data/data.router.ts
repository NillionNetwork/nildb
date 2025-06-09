import type { ControllerOptions } from "#/common/types";
import * as DataController from "./data.controllers";

export function buildDataRouter(options: ControllerOptions): void {
  DataController.remove(options);
  DataController.flush(options);
  DataController.read(options);
  DataController.tail(options);
  DataController.update(options);
  DataController.uploadOwnedData(options);
  DataController.uploadStandardData(options);
}
