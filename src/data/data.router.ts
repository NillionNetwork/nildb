import {} from "http-status-codes";
import * as DataController from "./data.controllers";
import type { ControllerOptions } from "#/common/types";

export function buildDataRouter(options: ControllerOptions): void {
  DataController.remove(options);
  DataController.flush(options);
  DataController.read(options);
  DataController.tail(options);
  DataController.update(options);
  DataController.upload(options);
}
