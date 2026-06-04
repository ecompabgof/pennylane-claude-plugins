import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { zodToJsonSchema } from "./zod-to-json.js";
import { PennylaneClient, PennylaneError } from "./client.js";
import { buildAllTools } from "./tools/registry.js";
import { filterToolsByScope, type Scope } from "./scope.js";
import { filterToolsByDomain, type Domain } from "./domains.js";

export function createMcpServer(
  client: PennylaneClient,
  opts: { scope: Scope; domain?: Domain },
): { server: Server; toolCount: number } {
  const scoped = filterToolsByScope(buildAllTools(client), opts.scope);
  const tools = filterToolsByDomain(scoped, opts.domain ?? "full");
  const toolMap = new Map(tools.map((t) => [t.name, t]));

  const server = new Server(
    { name: "pennylane-mcp", version: "0.1.0" },
    { capabilities: { tools: {} } },
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: tools.map((t) => ({
      name: t.name,
      description: t.description,
      inputSchema: zodToJsonSchema(t.inputSchema),
    })),
  }));

  server.setRequestHandler(CallToolRequestSchema, async (req) => {
    const { name, arguments: rawArgs } = req.params;
    const tool = toolMap.get(name);
    if (!tool) {
      return { isError: true, content: [{ type: "text", text: `Unknown tool: ${name}` }] };
    }
    try {
      const parsed = tool.inputSchema.parse(rawArgs ?? {});
      const result = await tool.handler(parsed as Record<string, unknown>);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    } catch (err) {
      if (err instanceof PennylaneError) {
        return {
          isError: true,
          content: [{
            type: "text",
            text: JSON.stringify({ status: err.status, message: err.message, details: err.body }, null, 2),
          }],
        };
      }
      if (err instanceof z.ZodError) {
        return { isError: true, content: [{ type: "text", text: `Invalid arguments: ${JSON.stringify(err.issues, null, 2)}` }] };
      }
      const msg = err instanceof Error ? err.message : String(err);
      return { isError: true, content: [{ type: "text", text: `Tool error: ${msg}` }] };
    }
  });

  return { server, toolCount: tools.length };
}
