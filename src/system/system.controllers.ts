import { Effect as E, pipe } from "effect";
import { StatusCodes, getReasonPhrase } from "http-status-codes";
import { SystemEndpoint } from "#/system/system.router";
import * as SystemService from "./system.services";
import type { ControllerOptions } from "#/common/types";

export function aboutNode(options: ControllerOptions): void {
  const { app } = options;

  app.get(SystemEndpoint.About, async (c) => {
    return await pipe(
      SystemService.getNodeInfo(c.env),
      E.flatMap((aboutNode) => E.succeed(c.json(aboutNode))),
      E.runPromise,
    );
  });
}

export function healthCheck(options: ControllerOptions): void {
  const { app } = options;

  app.get(SystemEndpoint.Health, async (c) =>
    c.text(getReasonPhrase(StatusCodes.OK)),
  );
}
