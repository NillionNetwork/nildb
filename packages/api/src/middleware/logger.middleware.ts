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
      const logLevel =
        status >= 500
          ? "error"
          : status >= 400
            ? "warn"
            : status >= 300
              ? "silent"
              : "debug";

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
