import type { ControllerOptions } from "#/common/types";

export function injectBindingsMiddleware(options: ControllerOptions): void {
  const { app, bindings } = options;

  app.use((c, next) => {
    c.env = bindings;
    return next();
  });
}
