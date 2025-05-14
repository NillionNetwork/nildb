import {
  McpServer,
  ResourceTemplate,
} from "@modelcontextprotocol/sdk/server/mcp";
import { SetLevelRequestSchema } from "@modelcontextprotocol/sdk/types";
import { z } from "zod";
import type { ControllerOptions } from "#/common/types";

export function createMcpServer(options: ControllerOptions): McpServer {
  const { log } = options.bindings;

  const server = new McpServer(
    {
      name: "WIP MCP Integration",
      version: "0.0.1",
    },
    { capabilities: { logging: {} } },
  );

  server.server.setRequestHandler(
    SetLevelRequestSchema,
    async (request, _extra) => {
      log.info(`logging/setLevel: ${request.params.level}`);
      return {};
    },
  );

  // Add an addition tool
  server.tool(
    "add",
    { a: z.number(), b: z.number() },
    async ({ a, b }, extra) => {
      log.info(`Executing tool 'add' with a=${a}, b=${b}`);

      try {
        await extra.sendNotification({
          method: "notifications/message",
          params: {
            level: "info",
            logMessage: `Tool 'add' executed with inputs: a=${a}, b=${b}`,
            logSource: "tool:add",
          },
        });
        log.info("Notification sent.");
      } catch (e) {
        log.error(e);
      }

      return {
        content: [{ type: "text", text: String(a + b) }],
      };
    },
  );

  // Add a resource
  server.resource("config", "config://app", async (uri) => ({
    contents: [
      {
        uri: uri.href,
        text: "App configuration here",
      },
    ],
  }));

  // Add a dynamic greeting resource
  server.resource(
    "greeting",
    new ResourceTemplate("greeting://{name}", { list: undefined }),
    async (uri, { name }) => ({
      contents: [
        {
          uri: uri.href,
          text: `Hello, ${name}!`,
        },
      ],
    }),
  );

  server.prompt("do-thing", { thing: z.string() }, ({ thing }) => ({
    messages: [
      {
        role: "user",
        content: { type: "text", text: `Do you want to ${thing}?` },
      },
    ],
  }));

  log.info("MCP Server instance created with tools/resources.");
  return server;
}
