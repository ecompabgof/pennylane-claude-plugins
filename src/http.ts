import express from "express";
import type { Server as HttpServer } from "node:http";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import type { PennylaneClient } from "./client.js";
import { createMcpServer } from "./server.js";
import { checkBearer } from "./auth.js";
import type { Scope } from "./scope.js";
import type { Domain } from "./domains.js";

export interface HttpOpts {
  client: PennylaneClient;
  scope: Scope;
  domain?: Domain;
  authToken: string;
}

export function createHttpApp(opts: HttpOpts) {
  const app = express();
  app.use(express.json({ limit: "10mb" }));

  app.get("/health", (_req, res) => {
    res.json({ ok: true });
  });

  // MCP endpoint — stateless: fresh server+transport per request.
  app.post("/mcp", async (req, res) => {
    if (!checkBearer(req.headers.authorization, opts.authToken)) {
      res.status(401).json({
        jsonrpc: "2.0",
        error: { code: -32001, message: "Unauthorized" },
        id: null,
      });
      return;
    }
    const { server } = createMcpServer(opts.client, { scope: opts.scope, domain: opts.domain });
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    res.on("close", () => {
      void transport.close();
      void server.close();
    });
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  });

  return app;
}

export function startHttpServer(opts: HttpOpts & { port: number }): HttpServer {
  const app = createHttpApp(opts);
  return app.listen(opts.port);
}
