#!/usr/bin/env node
// Env vars injected by Claude Code (.mcp.json) or a shell wrapper.
// Local dev: node --env-file=.env dist/index.js
//   MCP_TRANSPORT=stdio (default) | http
//   MCP_SCOPE=full (default) | read
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { PennylaneClient } from "./client.js";
import { createMcpServer } from "./server.js";
import { startHttpServer } from "./http.js";
import type { Scope } from "./scope.js";
import { DOMAINS, type Domain } from "./domains.js";

const token = process.env.PENNYLANE_API_TOKEN;
if (!token) {
  console.error("ERROR: PENNYLANE_API_TOKEN is not set in environment.");
  process.exit(1);
}

const scope: Scope = process.env.MCP_SCOPE === "read" ? "read" : "full";
const transport = process.env.MCP_TRANSPORT === "http" ? "http" : "stdio";
// MCP_DOMAIN filtre les tools par thème (ventes/achats/compta/banque/divers/full). Inconnu -> full.
const rawDomain = process.env.MCP_DOMAIN ?? "full";
const domain: Domain = (DOMAINS as string[]).includes(rawDomain) ? (rawDomain as Domain) : "full";

const client = new PennylaneClient({
  token,
  baseUrl: process.env.PENNYLANE_BASE_URL,
  use2026Api: process.env.PENNYLANE_USE_2026_API === "true",
});

async function main() {
  if (transport === "http") {
    const rawPort = process.env.MCP_HTTP_PORT;
    const port = rawPort ? Number(rawPort) : 8080;
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
      console.error(`ERROR: MCP_HTTP_PORT must be a valid port number (got ${rawPort}).`);
      process.exit(1);
    }
    const authToken = process.env.MCP_AUTH_TOKEN;
    if (!authToken?.trim()) {
      console.error("ERROR: MCP_AUTH_TOKEN is required (non-empty) for http transport.");
      process.exit(1);
    }
    startHttpServer({ client, scope, domain, port, authToken });
    console.error(`pennylane-mcp HTTP listening on :${port} (scope=${scope}, domain=${domain})`);
  } else {
    const { server, toolCount } = createMcpServer(client, { scope, domain });
    await server.connect(new StdioServerTransport());
    console.error(`pennylane-mcp started (stdio) — ${toolCount} tools (scope=${scope}, domain=${domain}).`);
  }
}

main().catch((e) => {
  console.error("Fatal:", e);
  process.exit(1);
});
