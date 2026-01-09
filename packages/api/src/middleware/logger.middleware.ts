import type { ControllerOptions } from "@nildb/common/types";
import type { MiddlewareHandler } from "hono";

export function loggerMiddleware(options: ControllerOptions): void {
  const { app, bindings } = options;
  const { log } = bindings;

  const middleware: MiddlewareHandler = async (c, next) => {
    const start = performance.now();
    const { method, url } = c.req;

    try {
      await next();

      const end = performance.now();
      const duration = Math.round(end - start);
      const status = c.res.status;

      // Log to console/OTel (automatic instrumentation handles traces and metrics)
      const logLevel = getLogLevel(status);

      if (logLevel !== "silent") {
        log[logLevel](
          {
            method,
            url,
            status,
            duration: `${duration}ms`,
          },
          `${method} ${url} ${status}`,
        );
      }
    } catch (err) {
      const duration = Math.round(performance.now() - start);

      log.error(
        {
          err,
          method,
          url,
          duration: `${duration}ms`,
        },
        `${method} ${url} error`,
      );
      throw err;
    }
  };

  app.use(middleware);
}

function getLogLevel(status: number): "error" | "warn" | "silent" | "debug" {
  if (status >= 500) return "error";
  if (status >= 400) return "warn";
  if (status >= 300) return "silent";
  return "debug";
}
