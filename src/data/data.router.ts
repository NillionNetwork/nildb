import { StatusCodes, getReasonPhrase } from "http-status-codes";
import type { App } from "#/app";
import { PathsV1 } from "#/common/paths";
import type { AppBindings } from "#/env";
import { isRoleAllowed } from "#/middleware/auth.middleware";
import * as DataController from "./data.controllers";

export function buildDataRouter(app: App, _bindings: AppBindings): void {
  app.use(
    `${PathsV1.data.root}/*`,
    // biome-ignore lint/suspicious/noConfusingVoidType: <explanation>
    async (c, next): Promise<void | Response> => {
      return isRoleAllowed(c, ["organization"])
        ? next()
        : c.text(
            getReasonPhrase(StatusCodes.UNAUTHORIZED),
            StatusCodes.UNAUTHORIZED,
          );
    },
  );

  DataController.remove(app);
  DataController.flush(app);
  DataController.read(app);
  DataController.tail(app);
  DataController.update(app);
  DataController.upload(app);
}
