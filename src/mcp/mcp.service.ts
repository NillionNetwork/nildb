import { randomUUID } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp";
import { Effect as E, pipe } from "effect";
import { toReqRes } from "fetch-to-node";
import type { Context } from "hono";
import {} from "http-status-codes";
import type { AppWithMcpEnv } from "#/mcp/mcp.router";
import {
  ConnectMcpServerError,
  type CreateTransportError,
  McpHandleRequestError,
  TransportNotFoundError,
} from "./mcp.types";

export function findTransport(
  c: Context<AppWithMcpEnv>,
  sid: string,
): E.Effect<StreamableHTTPServerTransport, TransportNotFoundError> {
  const transportsDb = c.get("transports");

  return pipe(
    E.fromNullable(transportsDb.get(sid)),
    E.mapError(() => new TransportNotFoundError({ sid })),
  );
}

export function handleTransportStream(
  _c: Context<AppWithMcpEnv>,
  transport: StreamableHTTPServerTransport,
  req: IncomingMessage,
  res: ServerResponse,
): E.Effect<void, McpHandleRequestError> {
  return E.tryPromise({
    try: () => transport.handleRequest(req, res),
    catch: (e) =>
      new McpHandleRequestError({
        sid: transport.sessionId ?? "missing",
        cause: e,
      }),
  });
}

export function handleTransportPost(
  c: Context<AppWithMcpEnv>,
  transport: StreamableHTTPServerTransport,
): E.Effect<ServerResponse, TypeError | McpHandleRequestError> {
  const { req, res } = toReqRes(c.req.raw);

  return pipe(
    E.tryPromise({
      try: () => c.req.json(),
      catch: (cause) => new TypeError("Failed to parse json body", { cause }),
    }),
    E.flatMap((body) =>
      E.tryPromise({
        try: async () => {
          await transport.handleRequest(req, res, body);
          return res;
        },
        catch: (e) =>
          new McpHandleRequestError({
            sid: transport.sessionId ?? "missing",
            cause: e,
          }),
      }),
    ),
  );
}

export function createTransport(
  c: Context<AppWithMcpEnv>,
): E.Effect<
  StreamableHTTPServerTransport,
  CreateTransportError | ConnectMcpServerError
> {
  const { log } = c.env;
  const transportsDb = c.get("transports");
  const mcpServer = c.get("mcp");

  let transportInstance: StreamableHTTPServerTransport;
  return pipe(
    E.sync(() => {
      transportInstance = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
        onsessioninitialized: (sid) => {
          log.info({ sid }, "New transport session initialized");
          transportsDb.set(sid, transportInstance);
        },
      });
      return transportInstance;
    }),
    E.tap((transport) =>
      E.sync(() => {
        // Use E.sync for synchronous listener setup
        transport.onclose = () => {
          const closedSessionId = transport.sessionId;
          if (closedSessionId && transportsDb.has(closedSessionId)) {
            log.info(
              { sid: closedSessionId },
              "Transport closed, removing from map.",
            );
            transportsDb.delete(closedSessionId);
          }
        };
        transport.onerror = (err) => {
          log.error(
            { sid: transport.sessionId || "init", err },
            "Transport error event",
          );
        };
      }),
    ),
    E.flatMap((transport) =>
      E.tryPromise({
        try: () => mcpServer.connect(transport),
        catch: (e) =>
          new ConnectMcpServerError({
            sid: transport.sessionId ?? "missing",
            cause: e,
          }),
      }),
    ),
    E.map(() => transportInstance),
  );
}
