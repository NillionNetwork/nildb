import { cors } from "hono/cors";
import type { ControllerOptions } from "#/common/types";

export function corsMiddleware(options: ControllerOptions): void {
  const { app } = options;

  // This enables cors with credentials for any URL deliberately.
  // Access controls are enforced by NUCs in capability.middleware.ts.
  app.use(
    cors({
      origin: (origin) => origin,
      allowHeaders: ["Content-Type", "Authorization"],
      allowMethods: ["GET", "POST", "DELETE"],
      maxAge: 3600,
      credentials: true,
    }),
  );
}
