import { readFileSync, readdirSync, existsSync } from "node:fs";
import { dirname, resolve, join, basename } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import type { McpTool } from "./factory.js";

interface DocSection {
  file: string;
  heading: string;
  level: number;
  body: string;
  lineStart: number;
}

function findDocsDir(): string | null {
  const here = dirname(fileURLToPath(import.meta.url));
  const candidates = [
    resolve(here, "./docs"),        // bundled plugin: docs next to pennylane-mcp.mjs
    resolve(here, "../../docs"),    // dev: dist/tools/ → project root
    resolve(here, "../docs"),       // dev: dist/ → project root
    resolve(here, "../../../docs"),
  ];
  for (const p of candidates) {
    if (existsSync(p)) return p;
  }
  return null;
}

function parseSections(filename: string, content: string): DocSection[] {
  const lines = content.split("\n");
  const sections: DocSection[] = [];
  let current: DocSection | null = null;
  lines.forEach((line, idx) => {
    const m = /^(#{1,6})\s+(.+?)\s*$/.exec(line);
    if (m) {
      if (current) sections.push(current);
      current = { file: filename, heading: m[2], level: m[1].length, body: "", lineStart: idx + 1 };
    } else if (current) {
      current.body += (current.body ? "\n" : "") + line;
    } else {
      current = { file: filename, heading: "(preamble)", level: 0, body: line, lineStart: 1 };
    }
  });
  if (current) sections.push(current);
  return sections.filter((s) => (s.body + s.heading).trim().length > 0);
}

function loadSections(): DocSection[] {
  const dir = findDocsDir();
  if (!dir) {
    console.error("[docs-search] docs/ directory not found; tool will return empty results.");
    return [];
  }
  const files = readdirSync(dir).filter((f) => f.endsWith(".md"));
  const out: DocSection[] = [];
  for (const f of files) {
    const content = readFileSync(join(dir, f), "utf8");
    out.push(...parseSections(f, content));
  }
  console.error(`[docs-search] Indexed ${out.length} sections from ${files.length} files in ${dir}`);
  return out;
}

function scoreSection(section: DocSection, terms: string[]): number {
  const hay = (section.heading + "\n" + section.body).toLowerCase();
  let score = 0;
  for (const t of terms) {
    if (!t) continue;
    const re = new RegExp(t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g");
    const matches = hay.match(re);
    if (matches) {
      score += matches.length;
      if (section.heading.toLowerCase().includes(t)) score += 5;
    }
  }
  return score;
}

function truncateBody(body: string, max = 1200): string {
  if (body.length <= max) return body;
  return body.slice(0, max) + `\n… [truncated, ${body.length - max} more chars]`;
}

export function makeDocsSearchTool(): McpTool {
  const sections = loadSections();

  return {
    name: "pennylane_docs_search",
    readOnly: true,
    description:
      "Search the bundled Pennylane API v2 docs (local Markdown). Returns top matching sections with heading, file, and body. Use before calling an endpoint to recall exact paths, payload shapes, or scope names.",
    inputSchema: z.object({
      query: z.string().describe("Search terms, space-separated. Case-insensitive. E.g. 'ledger entry letter', 'supplier invoice import', 'FEC export'."),
      limit: z.number().int().min(1).max(20).optional().describe("Max sections to return (default 5)."),
      files: z.array(z.string()).optional().describe("Restrict search to specific files (e.g. ['accounting.md','banking.md'])."),
    }),
    handler: async (args) => {
      const query = String(args.query).toLowerCase().trim();
      const terms = query.split(/\s+/).filter(Boolean);
      const limit = (args.limit as number | undefined) ?? 5;
      const fileFilter = args.files as string[] | undefined;

      const candidates = fileFilter?.length
        ? sections.filter((s) => fileFilter.some((f) => s.file === f || basename(f) === s.file))
        : sections;

      const scored = candidates
        .map((s) => ({ section: s, score: scoreSection(s, terms) }))
        .filter((x) => x.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, limit);

      return {
        query,
        total_matches: scored.length,
        total_sections_indexed: sections.length,
        results: scored.map(({ section, score }) => ({
          file: section.file,
          heading: section.heading,
          heading_level: section.level,
          line: section.lineStart,
          score,
          body: truncateBody(section.body),
        })),
      };
    },
  };
}
