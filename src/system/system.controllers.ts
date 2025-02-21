import { Effect as E, pipe } from "effect";
import { StatusCodes, getReasonPhrase } from "http-status-codes";
import type { App } from "#/app";
import { SystemEndpoint } from "#/system/system.router";
import * as SystemService from "./system.services";

export function aboutNode(app: App): void {
  app.get(SystemEndpoint.About, async (c) => {
    return await pipe(
      SystemService.getNodeInfo(c.env),
      E.flatMap((aboutNode) => E.succeed(c.json(aboutNode))),
      E.runPromise,
    );
  });
}

export function healthCheck(app: App): void {
  app.get(SystemEndpoint.Health, async (c) =>
    c.text(getReasonPhrase(StatusCodes.OK)),
  );
}
