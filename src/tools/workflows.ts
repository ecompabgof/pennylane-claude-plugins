import { readFileSync } from "node:fs";
import { basename } from "node:path";
import { z } from "zod";
import type { PennylaneClient } from "../client.js";
import type { McpTool } from "./factory.js";

function readPdfAsBase64(filePath: string): { base64: string; filename: string } {
  const buf = readFileSync(filePath);
  return { base64: buf.toString("base64"), filename: basename(filePath) };
}

function resolvePdfInput(args: {
  file_path?: unknown;
  content_base64?: unknown;
  filename?: unknown;
}): { base64: string; filename: string } {
  if (args.file_path) {
    return readPdfAsBase64(String(args.file_path));
  }
  if (args.content_base64) {
    return {
      base64: String(args.content_base64),
      filename: (args.filename ? String(args.filename) : "document.pdf"),
    };
  }
  throw new Error("Provide either file_path (absolute path to PDF) or content_base64 (+ filename).");
}

const pdfInputSchema = z
  .object({
    file_path: z.string().optional().describe("Absolute path to a local PDF file. Preferred — no base64 overhead."),
    content_base64: z.string().optional().describe("Fallback: raw PDF bytes as base64."),
    filename: z.string().optional().describe("Required if using content_base64."),
  })
  .refine((v) => v.file_path || v.content_base64, {
    message: "Provide file_path or content_base64",
  });

export function buildWorkflowTools(client: PennylaneClient): McpTool[] {
  const tools: McpTool[] = [];

  // ─── Supplier invoice: upload PDF + import (OCR) in one shot ─
  tools.push({
    name: "supplier_invoice_import_pdf",
    description:
      "High-level workflow: upload a PDF file, then create a supplier invoice from it. Pennylane performs OCR automatically. Optional metadata (supplier_id, date, amounts, invoice_lines...) overrides OCR values. Returns the created supplier invoice.",
    inputSchema: z.object({
      file_path: z.string().optional().describe("Absolute path to the PDF. Preferred."),
      content_base64: z.string().optional().describe("Alternative: raw bytes as base64."),
      filename: z.string().optional(),
      metadata: z.record(z.any()).optional().describe(
        "Optional pre-filled fields merged into the import payload (supplier_id, date, deadline, invoice_number, currency_amount, currency_amount_before_tax, currency_tax, invoice_lines, external_reference, ...). Amounts MUST be strings.",
      ),
    }),
    handler: async (args) => {
      const { base64, filename } = resolvePdfInput(args);
      const uploaded = (await client.upload<{ id: number }>("/file_attachments", base64, filename, "file"));
      const fileAttachmentId = (uploaded && typeof uploaded === "object" && "id" in uploaded) ? (uploaded as { id: number }).id : uploaded;
      const body = { file_attachment_id: fileAttachmentId, ...((args.metadata as Record<string, unknown>) ?? {}) };
      const invoice = await client.post("/supplier_invoices/import", body);
      return { file_attachment_id: fileAttachmentId, supplier_invoice: invoice };
    },
  });

  // ─── Customer invoice: upload PDF + import ──────────────────
  tools.push({
    name: "customer_invoice_import_pdf",
    description:
      "High-level workflow: upload a PDF and create a customer invoice from it. Unlike supplier import, the customer import requires metadata (customer_id, date, deadline, amounts, invoice_lines) because Pennylane does not OCR customer invoices.",
    inputSchema: z.object({
      file_path: z.string().optional(),
      content_base64: z.string().optional(),
      filename: z.string().optional(),
      metadata: z.record(z.any()).describe("Required payload: customer_id, date, deadline, amounts, invoice_lines[], etc."),
    }),
    handler: async (args) => {
      const { base64, filename } = resolvePdfInput(args);
      const uploaded = (await client.upload<{ id: number }>("/file_attachments", base64, filename, "file"));
      const fileAttachmentId = (uploaded && typeof uploaded === "object" && "id" in uploaded) ? (uploaded as { id: number }).id : uploaded;
      const body = { file_attachment_id: fileAttachmentId, ...((args.metadata as Record<string, unknown>) ?? {}) };
      const invoice = await client.post("/customer_invoices/import", body);
      return { file_attachment_id: fileAttachmentId, customer_invoice: invoice };
    },
  });

  // ─── Quote attachment: upload + attach in one call ──────────
  tools.push({
    name: "quote_attach_pdf",
    description: "High-level workflow: upload a PDF and attach it as appendix to a quote.",
    inputSchema: z.object({
      quote_id: z.union([z.string(), z.number()]),
      file_path: z.string().optional(),
      content_base64: z.string().optional(),
      filename: z.string().optional(),
    }),
    handler: async (args) => {
      const { base64, filename } = resolvePdfInput(args);
      const uploaded = (await client.upload<{ id: number }>("/file_attachments", base64, filename, "file"));
      const fileAttachmentId = (uploaded && typeof uploaded === "object" && "id" in uploaded) ? (uploaded as { id: number }).id : uploaded;
      const appendix = await client.post(`/quotes/${args.quote_id}/appendices`, { file_attachment_id: fileAttachmentId });
      return { file_attachment_id: fileAttachmentId, appendix };
    },
  });

  // ─── FEC export: create + poll until ready ──────────────────
  tools.push({
    name: "fec_export_and_wait",
    description: "High-level workflow: trigger an FEC export and poll until it completes (or timeout). Returns the final status with file_url.",
    inputSchema: z.object({
      body: z.record(z.any()).optional().describe("Optional FEC export parameters (fiscal_year_id, start_date, end_date...)."),
      poll_interval_seconds: z.number().int().min(1).max(30).optional().describe("Default 3s"),
      timeout_seconds: z.number().int().min(5).max(600).optional().describe("Default 120s"),
    }),
    handler: async (args) => {
      const interval = ((args.poll_interval_seconds as number | undefined) ?? 3) * 1000;
      const timeoutMs = ((args.timeout_seconds as number | undefined) ?? 120) * 1000;
      const started = Date.now();
      const init = (await client.post<{ id: number; status?: string }>("/exports/fecs", (args.body as object) ?? {}));
      const id = init.id;
      let last = init;
      while (Date.now() - started < timeoutMs) {
        if (last.status && last.status !== "pending" && last.status !== "processing") break;
        await new Promise((r) => setTimeout(r, interval));
        last = await client.get<{ id: number; status?: string }>(`/exports/fecs/${id}`);
      }
      return { export: last, elapsed_ms: Date.now() - started, timed_out: last.status === "pending" || last.status === "processing" };
    },
  });

  return tools;
}
