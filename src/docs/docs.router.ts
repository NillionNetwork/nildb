import path from "node:path";
import { fileURLToPath } from "node:url";
import refParser from "@apidevtools/json-schema-ref-parser";
import { swaggerUI } from "@hono/swagger-ui";
import { PathsV1 } from "#/common/paths";
import type { ControllerOptions } from "#/common/types";

export function createOpenApiRouter(options: ControllerOptions): void {
  const { app, bindings } = options;

  const filename = fileURLToPath(import.meta.url);
  const srcDocsDir = path.dirname(filename);
  const openApiPath = path.join(srcDocsDir, "./base.openapi.yaml");

  refParser
    .bundle(openApiPath, {
      dereference: {
        circular: true,
      },
    })
    .then((spec) => {
      app.use(`${PathsV1.docs}/*`, swaggerUI({ url: "", spec }));
      bindings.log.info(`Openapi docs on :${bindings.config.webPort}`);
    })
    .catch((error) => {
      bindings.log.info("Failed to load openapi spec: %O", error);
    });
}
