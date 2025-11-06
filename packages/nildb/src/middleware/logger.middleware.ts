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
      const status = c.res.status;

      const logLevel =
        status >= 500
          ? "error"
          : status >= 400
            ? "warn"
            : status >= 300
              ? "silent"
              : "debug";

      if (logLevel !== "silent") {
        log[logLevel]({
          method,
          url,
          status,
          duration: `${Math.round(end - start)}ms`,
        });
      }
    } catch (err) {
      log.error({
        err,
        method,
        url,
        duration: `${Math.round(performance.now() - start)}ms`,
      });
      throw err;
    }
  };

  app.use(middleware);
}
