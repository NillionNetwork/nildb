import type { ControllerOptions } from "@nildb/common/types";
import { bodyLimit } from "hono/body-limit";

export function limitRequestBodySizeMiddleware(options: ControllerOptions): void {
  const { app } = options;

  // crudely, limit body the mongodb's 16mb max document size
  app.use("*", bodyLimit({ maxSize: 16 * 1024 * 1024 }));
}
