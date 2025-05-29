import type { ControllerOptions } from "#/common/types";
import * as DataController from "./data.controllers";

export function buildDataRouter(options: ControllerOptions): void {
  DataController.remove(options);
  DataController.flush(options);
  DataController.read(options);
  DataController.tail(options);
  DataController.update(options);
  DataController.upload(options);
  DataController.readPermissions(options);
  DataController.addPermissions(options);
  DataController.updatePermissions(options);
  DataController.deletePermissions(options);
}
