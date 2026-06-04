#!/usr/bin/env node
// Entrée dédiée aux plugins (stdio seulement, sans HTTP/express) → bundle autonome propre.
// Variables : PENNYLANE_API_TOKEN (requis), MCP_DOMAIN (ventes|achats|compta|banque|divers|full),
//             MCP_SCOPE (full par défaut | read), PENNYLANE_BASE_URL, PENNYLANE_USE_2026_API.
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { PennylaneClient } from "./client.js";
import { createMcpServer } from "./server.js";
import type { Scope } from "./scope.js";
import { DOMAINS, type Domain } from "./domains.js";

const token = process.env.PENNYLANE_API_TOKEN;
if (!token) {
  console.error("ERROR: PENNYLANE_API_TOKEN is not set in environment.");
  process.exit(1);
}

const scope: Scope = process.env.MCP_SCOPE === "read" ? "read" : "full";
const rawDomain = process.env.MCP_DOMAIN ?? "full";
const domain: Domain = (DOMAINS as string[]).includes(rawDomain) ? (rawDomain as Domain) : "full";

const client = new PennylaneClient({
  token,
  baseUrl: process.env.PENNYLANE_BASE_URL,
  use2026Api: process.env.PENNYLANE_USE_2026_API === "true",
});

const { server, toolCount } = createMcpServer(client, { scope, domain });
await server.connect(new StdioServerTransport());
console.error(`pennylane-mcp (plugin) — ${toolCount} tools (scope=${scope}, domain=${domain}).`);
