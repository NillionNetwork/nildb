import { Cause, Effect as E, Exit, Option as O, pipe } from "effect";
import { toFetchResponse, toReqRes } from "fetch-to-node";
import { StatusCodes, getReasonPhrase } from "http-status-codes";
import type { McpControllerOptions } from "./mcp.router";
import * as McpService from "./mcp.service";
import { TransportNotFoundError } from "./mcp.types";

export function post(options: McpControllerOptions): void {
  const { app, bindings } = options;
  const { log } = bindings;

  app.post("/mcp", async (c) => {
    const sidHeader = c.req.header("mcp-session-id") ?? "missing";

    const result = await pipe(
      McpService.findTransport(c, sidHeader),
      E.catchTag("TransportNotFoundError", (_e) =>
        McpService.createTransport(c),
      ),
      E.flatMap((transport) => McpService.handleTransportPost(c, transport)),
      E.runPromiseExit,
    );

    if (Exit.isSuccess(result)) {
      log.info("Post succeeded", { sid: sidHeader });
      return toFetchResponse(result.value);
    }

    return new Response(null, { status: StatusCodes.INTERNAL_SERVER_ERROR });
  });
}

export function get(options: McpControllerOptions): void {
  const { app, bindings } = options;
  const { log } = bindings;

  app.get("/mcp", async (c) => {
    const { req, res } = toReqRes(c.req.raw);
    const sidHeader = c.req.header("mcp-session-id");

    const result = await pipe(
      E.fromNullable(sidHeader),
      E.mapError(() => new TransportNotFoundError({ sid: "missing" })),
      E.flatMap((sid) => McpService.findTransport(c, sid)),
      E.flatMap((transport) =>
        McpService.handleTransportStream(c, transport, req, res),
      ),
      E.runPromiseExit,
    );

    if (Exit.isSuccess(result)) {
      log.info("Get succeeded", { sid: sidHeader });
      return undefined; // Signals to hono that the response is handled natively
    }

    const cause = result.cause;
    const failure = Cause.failureOption(cause);

    if (O.isSome(failure) && failure.value instanceof TransportNotFoundError) {
      log.warn("Transport not found", { sid: failure.value.sid });
      return c.json(
        { message: "Failed to find the MCP session" },
        StatusCodes.NOT_FOUND,
      );
    }

    const detail = Cause.pretty(cause);
    const code = StatusCodes.INTERNAL_SERVER_ERROR;
    log.error("Failed to process the MCP get request", { detail });

    if (res.writableEnded) {
      log.warn("Cannot send 500 because stream ended.", {
        sid: sidHeader,
      });
      return new Response(null, { status: code });
    }

    return c.json({ message: getReasonPhrase(code) }, code);
  });
}

export function _delete(options: McpControllerOptions): void {
  const { app, bindings } = options;
  const { log } = bindings;

  app.delete("/mcp", async (c) => {
    const { req, res } = toReqRes(c.req.raw);
    const sidHeader = c.req.header("mcp-session-id");

    const result = await pipe(
      E.fromNullable(sidHeader),
      E.mapError(() => new TransportNotFoundError({ sid: "missing" })),
      E.flatMap((sid) => McpService.findTransport(c, sid)),
      E.flatMap((transport) =>
        McpService.handleTransportStream(c, transport, req, res),
      ),
      E.runPromiseExit,
    );

    if (Exit.isSuccess(result)) {
      log.info("Transport deleted", { sid: sidHeader });
      return undefined; // Signals to hono that the response is handled natively
    }

    const cause = result.cause;
    const failure = Cause.failureOption(cause);

    if (O.isSome(failure) && failure.value instanceof TransportNotFoundError) {
      log.warn("Transport not found", { sid: failure.value.sid });
      return c.json(
        { message: "Failed to find the MCP session to close" },
        StatusCodes.NOT_FOUND,
      );
    }

    const detail = Cause.pretty(cause);
    const code = StatusCodes.INTERNAL_SERVER_ERROR;
    log.error("Failed to close the MCP session", { detail });

    if (res.writableEnded) {
      log.warn("Cannot send 500 because stream ended.", {
        sid: sidHeader,
      });
      return new Response(null, { status: code });
    }

    return c.json({ message: getReasonPhrase(code) }, code);
  });
}
