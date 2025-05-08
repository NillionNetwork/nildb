import type { HttpBindings } from "@hono/node-server";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp";
import type { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp";
import type { Hono } from "hono";
import type { ControllerOptions } from "#/common/types";
import type { AppBindings, AppVariables } from "#/env";
import { createMcpServer } from "#/mcp/mcp.server";
import * as McpControllers from "./mcp.controllers";

export type McpAppBindings = HttpBindings & AppBindings;

export type McpAppVariables = AppVariables & {
  transports: Map<string, StreamableHTTPServerTransport>;
  mcp: McpServer;
};

export type AppWithMcpEnv = {
  Bindings: McpAppBindings;
  Variables: McpAppVariables;
};

export type AppWithMcp = Hono<AppWithMcpEnv>;

export type McpControllerOptions = {
  app: AppWithMcp;
  bindings: McpAppBindings;
};

export function buildMcpRouter(options: ControllerOptions): void {
  const transports = new Map<string, StreamableHTTPServerTransport>();
  const mcpServer = createMcpServer(options);

  const mcpOptions = options as unknown as McpControllerOptions;

  mcpOptions.app.use((c, next) => {
    c.set("transports", transports);
    c.set("mcp", mcpServer);
    return next();
  });

  // MCP's StreamableHTTP expects three endpoints:
  // Post - client-to-server data
  // GET - server-to-client data
  // DELETE - close the stream
  McpControllers.post(mcpOptions);
  McpControllers.get(mcpOptions);
  McpControllers._delete(mcpOptions);
}
