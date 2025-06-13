import { timeout } from "hono/timeout";
import { Temporal } from "temporal-polyfill";
import type { ControllerOptions } from "#/common/types";

export function limitRequestBodySizeMiddleware(
  options: ControllerOptions,
): void {
  const { app } = options;

  const limit = Temporal.Duration.from({ minutes: 5 }).total("milliseconds");
  app.use("*", timeout(limit));
}
