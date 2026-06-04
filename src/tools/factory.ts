import { z } from "zod";
import type { PennylaneClient } from "../client.js";

export interface McpTool {
  name: string;
  description: string;
  inputSchema: z.ZodTypeAny;
  handler: (args: Record<string, unknown>) => Promise<unknown>;
  /** true = sûr en scope lecture seule. Allowlist : non tagué = exclu du scope read. */
  readOnly?: boolean;
}

// Common list args (cursor pagination + filter + sort)
export const listArgsSchema = z.object({
  page_size: z.number().int().min(1).max(100).optional().describe("page[size] — items per page, max 100"),
  page_after: z.string().optional().describe("page[after] cursor from previous response's pagination.after"),
  filter: z.array(z.object({
    field: z.string(),
    operator: z.enum(["eq", "not_eq", "gt", "gte", "lt", "lte", "start_with", "in", "not_in"]),
    value: z.union([z.string(), z.number(), z.boolean(), z.array(z.union([z.string(), z.number()]))]),
  })).optional().describe("Pennylane filter array, e.g. [{field:'status',operator:'eq',value:'finalized'}]"),
  sort: z.string().optional().describe("Sort field, prefix '-' for desc (e.g. '-date')"),
  auto_paginate: z.boolean().optional().describe("If true, follow all pages and merge .data arrays (⚠️ large results cost context)"),
});

function buildListQuery(args: Record<string, unknown>): Record<string, unknown> {
  const q: Record<string, unknown> = {};
  if (args.page_size != null) q["page[size]"] = args.page_size;
  if (args.page_after) q["page[after]"] = args.page_after;
  if (args.filter) q["filter"] = args.filter;
  if (args.sort) q["sort"] = args.sort;
  return q;
}

async function listWithOptionalAutoPaginate(
  client: PennylaneClient,
  path: string,
  args: Record<string, unknown>,
): Promise<unknown> {
  const auto = Boolean(args.auto_paginate);
  if (!auto) {
    return client.get(path, buildListQuery(args));
  }
  const all: unknown[] = [];
  let cursor: string | undefined = args.page_after as string | undefined;
  let pages = 0;
  while (true) {
    const q = buildListQuery({ ...args, page_after: cursor });
    const res = (await client.get(path, q)) as { data?: unknown[]; pagination?: { after?: string | null } };
    if (Array.isArray(res?.data)) all.push(...res.data);
    else if (Array.isArray(res)) all.push(...res);
    cursor = res?.pagination?.after ?? undefined;
    pages++;
    if (!cursor || pages >= 50) break; // hard cap to avoid runaway
  }
  return { data: all, pages_fetched: pages, truncated: pages >= 50 };
}

export interface ResourceOptions {
  name: string;              // e.g. "customer_invoices"
  path: string;              // e.g. "/customer_invoices"
  singular?: string;         // e.g. "customer_invoice"
  supports?: Partial<Record<"list" | "get" | "create" | "update" | "delete", boolean>>;
  description?: string;
  createHints?: string;      // field-shape hint appended to create description
  updateHints?: string;      // field-shape hint appended to update description
  listHints?: string;        // hint for list (e.g. filterable fields)
}

export function makeResourceTools(client: PennylaneClient, opts: ResourceOptions): McpTool[] {
  const { name, path } = opts;
  const singular = opts.singular ?? name.replace(/s$/, "");
  const supports = { list: true, get: true, create: true, update: true, delete: false, ...opts.supports };
  const desc = opts.description ? ` — ${opts.description}` : "";
  const tools: McpTool[] = [];

  if (supports.list) {
    const listDesc = `List ${name}${desc}. Cursor paginated. Use auto_paginate=true to fetch all pages.${opts.listHints ? ` Filterable: ${opts.listHints}` : ""}`;
    tools.push({
      name: `${name}_list`,
      description: listDesc,
      inputSchema: listArgsSchema,
      handler: (args) => listWithOptionalAutoPaginate(client, path, args),
      readOnly: true,
    });
  }
  if (supports.get) {
    tools.push({
      name: `${singular}_get`,
      description: `Get one ${singular} by id${desc}.`,
      inputSchema: z.object({ id: z.union([z.string(), z.number()]) }),
      handler: (args) => client.get(`${path}/${args.id}`),
      readOnly: true,
    });
  }
  if (supports.create) {
    const hints = opts.createHints ? ` BODY SHAPE: ${opts.createHints}` : "";
    tools.push({
      name: `${singular}_create`,
      description: `Create a ${singular}${desc}. Amounts as strings ("120.00").${hints}`,
      inputSchema: z.object({ body: z.record(z.any()).describe(opts.createHints ?? "Resource payload per Pennylane API v2") }),
      handler: (args) => client.post(path, args.body),
    });
  }
  if (supports.update) {
    const hints = opts.updateHints ?? opts.createHints;
    const hintStr = hints ? ` FIELDS: ${hints}` : "";
    tools.push({
      name: `${singular}_update`,
      description: `Update a ${singular} by id${desc}. Send only changed fields.${hintStr}`,
      inputSchema: z.object({ id: z.union([z.string(), z.number()]), body: z.record(z.any()) }),
      handler: (args) => client.put(`${path}/${args.id}`, args.body),
    });
  }
  if (supports.delete) {
    tools.push({
      name: `${singular}_delete`,
      description: `Delete a ${singular} by id${desc}.`,
      inputSchema: z.object({ id: z.union([z.string(), z.number()]) }),
      handler: (args) => client.delete(`${path}/${args.id}`),
    });
  }
  return tools;
}
