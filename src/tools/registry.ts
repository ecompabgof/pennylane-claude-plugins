import { z } from "zod";
import type { PennylaneClient } from "../client.js";
import { makeResourceTools, type McpTool, listArgsSchema } from "./factory.js";
import { makeDocsSearchTool } from "./docs-search.js";
import { buildWorkflowTools } from "./workflows.js";

// Helper for nested sub-resource lists (e.g. /customer_invoices/:id/invoice_lines)
function subList(client: PennylaneClient, template: (id: string | number) => string) {
  return async (args: Record<string, unknown>) => {
    const id = args.id as string | number;
    const q: Record<string, unknown> = {};
    if (args.page_size != null) q["page[size]"] = args.page_size;
    if (args.page_after) q["page[after]"] = args.page_after;
    return client.get(template(id), q);
  };
}

const subListArgs = z.object({
  id: z.union([z.string(), z.number()]),
  page_size: z.number().int().min(1).max(100).optional(),
  page_after: z.string().optional(),
});

export function buildAllTools(client: PennylaneClient): McpTool[] {
  const tools: McpTool[] = [];

  // ─── High-level workflows (upload+import, export+poll...) ──
  tools.push(...buildWorkflowTools(client));

  // ─── Docs (bundled local search) ───────────────────────────
  tools.push(makeDocsSearchTool());

  // ─── Identity ──────────────────────────────────────────────
  tools.push({
    name: "me",
    description: "Get info about the current API user (id, email, role, scopes).",
    inputSchema: z.object({}),
    handler: () => client.get("/me"),
    readOnly: true,
  });

  // ─── Sales: Customers ──────────────────────────────────────
  // NOTE: Pennylane v2 splits write endpoints by type:
  //   POST   /company_customers      POST   /individual_customers
  //   PATCH  /company_customers/{id} PATCH  /individual_customers/{id}
  // Reads (GET /customers, GET /customers/{id}) remain unified.
  tools.push(...makeResourceTools(client, {
    name: "customers", path: "/customers", singular: "customer",
    supports: { create: false, update: false, delete: false }, // custom handlers below
    description: "Unified read endpoint for both company and individual customers",
    listHints: "name, external_reference, updated_at, customer_type",
  }));

  tools.push({
    name: "customer_create",
    description:
      'Create a customer. Routes on customer_type to POST /company_customers or POST /individual_customers (there is NO POST /customers). ' +
      'COMPANY body (customer_type="company"): REQUIRED {name, billing_address:{address, postal_code, city, country_alpha2:"FR"}}. OPTIONAL {reg_no (SIREN), vat_number, emails:[], phone, delivery_address, billing_iban, recipient, reference, notes, external_reference (must be unique), payment_conditions (default "30_days", enum: "upon_receipt|custom|7_days|15_days|30_days|30_days_end_of_month|45_days|45_days_end_of_month|60_days"), billing_language (default "fr_FR", enum: "fr_FR|en_GB|de_DE"), ledger_account}. ' +
      'INDIVIDUAL body (customer_type="individual"): REQUIRED {first_name, last_name, billing_address, delivery_address}. OPTIONAL: same as company except no reg_no/vat_number/name. ' +
      'The customer_type field is consumed by the router and NOT sent to Pennylane.',
    inputSchema: z.object({
      body: z.record(z.any()).describe('Must include customer_type:"company"|"individual". See description for per-type shape.'),
    }),
    handler: async (args) => {
      const body = { ...(args.body as Record<string, unknown>) };
      const type = body.customer_type;
      delete body.customer_type;
      if (type === "company") return client.post("/company_customers", body);
      if (type === "individual") return client.post("/individual_customers", body);
      throw new Error(`customer_create requires body.customer_type to be "company" or "individual" (got ${JSON.stringify(type)}).`);
    },
  });

  tools.push({
    name: "customer_update",
    description:
      'Update a customer via PUT /company_customers/{id} or PUT /individual_customers/{id}. ' +
      'If body.customer_type is absent, the tool auto-resolves it via GET /customers/{id} first. ' +
      'Send only the fields you want to change. Same field set as create (except customer_type which is consumed by the router).',
    inputSchema: z.object({
      id: z.union([z.string(), z.number()]),
      body: z.record(z.any()).describe('Partial update fields. customer_type optional — auto-resolved if missing.'),
    }),
    handler: async (args) => {
      const body = { ...(args.body as Record<string, unknown>) };
      let type = body.customer_type as string | undefined;
      delete body.customer_type;

      if (!type) {
        const fetched = (await client.get(`/customers/${args.id}`)) as { customer_type?: string; data?: { customer_type?: string } };
        type = fetched.customer_type ?? fetched.data?.customer_type;
        if (!type) throw new Error(`Could not resolve customer_type for id=${args.id}. Pass it explicitly in body.`);
      }

      if (type === "company") return client.put(`/company_customers/${args.id}`, body);
      if (type === "individual") return client.put(`/individual_customers/${args.id}`, body);
      throw new Error(`Unknown customer_type: ${type}`);
    },
  });

  // ─── Sales: Customer Invoices ──────────────────────────────
  tools.push(...makeResourceTools(client, {
    name: "customer_invoices", path: "/customer_invoices", singular: "customer_invoice",
    supports: { delete: false },
    createHints: '{customer_id, date:"YYYY-MM-DD", deadline:"YYYY-MM-DD", invoice_lines:[{label, quantity, unit:"hour|day|piece|...", raw_currency_unit_price:"150.00", vat_rate:"FR_200|FR_100|FR_55|FR_21|FR_00"}], external_reference?, currency?:"EUR"}. Pennylane generates the PDF.',
    listHints: "status (draft|finalized|paid), date, deadline, customer_id, paid, external_reference, updated_at",
  }));
  tools.push(
    {
      name: "customer_invoice_import",
      description: 'Import a customer invoice from an existing PDF. BODY: {file_attachment_id, date, deadline, customer_id, currency_amount_before_tax:"1000.00", currency_amount:"1200.00", currency_tax:"200.00", invoice_lines:[{currency_amount, currency_tax, quantity, raw_currency_unit_price, unit, vat_rate:"FR_200"}]}. No PDF generation (use customer_invoice_create for that).',
      inputSchema: z.object({ body: z.record(z.any()) }),
      handler: (a) => client.post("/customer_invoices/import", a.body),
    },
    {
      name: "customer_invoice_finalize",
      description: 'Finalize a draft customer invoice. After this: PDF is generated (if not imported), invoice number is assigned, and the invoice becomes legally official (immutable). Body-less.',
      inputSchema: z.object({ id: z.union([z.string(), z.number()]) }),
      handler: (a) => client.put(`/customer_invoices/${a.id}/finalize`, {}),
    },
    {
      name: "customer_invoice_send_by_email",
      description: 'Send a customer invoice by email. BODY (optional): {to:["x@y.com"], cc?:[], subject?, body?}. If omitted, uses the customer default email and the template configured in Pennylane.',
      inputSchema: z.object({ id: z.union([z.string(), z.number()]), body: z.record(z.any()).optional() }),
      handler: (a) => client.post(`/customer_invoices/${a.id}/send_by_email`, a.body ?? {}),
    },
    {
      name: "customer_invoice_from_quote",
      description: 'Convert an accepted quote into a customer invoice via POST /customer_invoices/create_from_quote. BODY: {quote_id, ...}. Returns the created draft invoice inheriting the quote attributes.',
      inputSchema: z.object({ body: z.object({ quote_id: z.union([z.string(), z.number()]) }).passthrough() }),
      handler: (a) => client.post("/customer_invoices/create_from_quote", a.body),
    },
    {
      name: "customer_invoice_e_invoice_import",
      description: 'Attach a Factur-X/UBL/CII e-invoice to an existing customer invoice. Upload the XML via file_attachment_upload first. BODY: {file_attachment_id}.',
      inputSchema: z.object({ id: z.union([z.string(), z.number()]), body: z.record(z.any()) }),
      handler: (a) => client.post(`/customer_invoices/${a.id}/e_invoice_import`, a.body),
    },
    {
      name: "customer_invoice_lines_list",
      description: "List invoice lines for a customer invoice.",
      inputSchema: subListArgs,
      handler: subList(client, (id) => `/customer_invoices/${id}/invoice_lines`),
      readOnly: true,
    },
    {
      name: "customer_invoice_payments_list",
      description: "List payments of a customer invoice.",
      inputSchema: subListArgs,
      handler: subList(client, (id) => `/customer_invoices/${id}/payments`),
      readOnly: true,
    },
    {
      name: "customer_invoice_matched_transactions_list",
      description: "List transactions matched to a customer invoice.",
      inputSchema: subListArgs,
      handler: subList(client, (id) => `/customer_invoices/${id}/matched_transactions`),
      readOnly: true,
    },
    {
      name: "customer_invoice_match_transaction",
      description: "Match a bank transaction to a customer invoice.",
      inputSchema: z.object({ id: z.union([z.string(), z.number()]), transaction_id: z.union([z.string(), z.number()]) }),
      handler: (a) => client.post(`/customer_invoices/${a.id}/matched_transactions`, { transaction_id: a.transaction_id }),
    },
    {
      name: "customer_invoice_unmatch_transaction",
      description: "Remove match between a bank transaction and a customer invoice.",
      inputSchema: z.object({ id: z.union([z.string(), z.number()]), transaction_id: z.union([z.string(), z.number()]) }),
      handler: (a) => client.delete(`/customer_invoices/${a.id}/matched_transactions/${a.transaction_id}`),
    },
    {
      name: "customer_invoices_changes_list",
      description: 'Incremental changelog for customer invoices (for external sync). Filter: [{field:"updated_at",operator:"gt",value:"2026-01-01T00:00:00Z"}] to fetch only changes since last sync.',
      inputSchema: listArgsSchema,
      handler: (a) => client.get("/customer_invoices/changes", {
        "page[size]": a.page_size, "page[after]": a.page_after, filter: a.filter, sort: a.sort,
      }),
      readOnly: true,
    },
  );

  // ─── Sales: Products ───────────────────────────────────────
  tools.push(...makeResourceTools(client, {
    name: "products", path: "/products", singular: "product", supports: { delete: false },
    createHints: '{label, description?, price:"100.00" (HT), price_with_tax?:"120.00", vat_rate:"FR_200", unit:"hour|day|piece|...", reference?, currency?:"EUR"}',
    listHints: "label, reference, updated_at",
  }));
  tools.push({
    name: "products_changes_list",
    description: 'Incremental changelog for products. Filter by updated_at for sync.',
    inputSchema: listArgsSchema,
    handler: (a) => client.get("/products/changes", { "page[size]": a.page_size, "page[after]": a.page_after, filter: a.filter, sort: a.sort }),
    readOnly: true,
  });

  // ─── Sales: Quotes ─────────────────────────────────────────
  tools.push(...makeResourceTools(client, {
    name: "quotes", path: "/quotes", singular: "quote", supports: { delete: false },
    createHints: '{customer_id, date, deadline, invoice_lines:[{label, quantity, unit, raw_currency_unit_price, vat_rate}], external_reference?, currency?}',
    listHints: "status (draft|pending|accepted|refused), customer_id, date, updated_at",
  }));
  tools.push(
    {
      name: "quote_send_by_email",
      description: 'Send a quote by email to the customer. BODY (optional): {to?:["x@y.com"], cc?, subject?, body?}. If omitted, uses the customer default email and Pennylane template.',
      inputSchema: z.object({ id: z.union([z.string(), z.number()]), body: z.record(z.any()).optional() }),
      handler: (a) => client.post(`/quotes/${a.id}/send_by_email`, a.body ?? {}),
    },
    {
      name: "quote_update_status",
      description: 'Change a quote status. BODY: {status:"draft|pending|accepted|refused|canceled"}.',
      inputSchema: z.object({ id: z.union([z.string(), z.number()]), body: z.record(z.any()) }),
      handler: (a) => client.put(`/quotes/${a.id}/status`, a.body),
    },
    {
      name: "quote_lines_list",
      inputSchema: subListArgs, description: "List invoice lines of a quote.",
      handler: subList(client, (id) => `/quotes/${id}/invoice_lines`),
      readOnly: true,
    },
    {
      name: "quote_appendices_list",
      inputSchema: subListArgs, description: "List appendices (PDFs) attached to a quote.",
      handler: subList(client, (id) => `/quotes/${id}/appendices`),
      readOnly: true,
    },
    {
      name: "quote_appendix_add",
      description: 'Attach a PDF appendix to a quote. Upload via file_attachment_upload first. BODY: {file_attachment_id}. For upload+attach in one call, use quote_attach_pdf.',
      inputSchema: z.object({ id: z.union([z.string(), z.number()]), body: z.record(z.any()) }),
      handler: (a) => client.post(`/quotes/${a.id}/appendices`, a.body),
    },
    {
      name: "quotes_changes_list",
      description: 'Incremental changelog for quotes. Filter by updated_at for sync.',
      inputSchema: listArgsSchema,
      handler: (a) => client.get("/quotes/changes", { "page[size]": a.page_size, "page[after]": a.page_after, filter: a.filter, sort: a.sort }),
      readOnly: true,
    },
  );

  // ─── Sales: Commercial Documents ───────────────────────────
  tools.push(...makeResourceTools(client, {
    name: "commercial_documents", path: "/commercial_documents", singular: "commercial_document",
    supports: { create: false, update: false, delete: false },
    description: "Unified view of invoices + quotes (read-only)",
    listHints: 'type ("customer_invoice"|"quote"|"supplier_invoice"), status, date, customer_id, supplier_id, updated_at',
  }));
  tools.push(
    { name: "commercial_document_lines_list", inputSchema: subListArgs,
      description: "List the invoice lines of a commercial document (invoice or quote via unified view).",
      handler: subList(client, (id) => `/commercial_documents/${id}/invoice_lines`), readOnly: true },
    { name: "commercial_document_appendices_list", inputSchema: subListArgs,
      description: "List PDF appendices attached to a commercial document.",
      handler: subList(client, (id) => `/commercial_documents/${id}/appendices`), readOnly: true },
    { name: "commercial_document_appendix_add",
      inputSchema: z.object({ id: z.union([z.string(), z.number()]), body: z.record(z.any()) }),
      description: 'Attach a PDF appendix to a commercial document. Upload via file_attachment_upload first. BODY: {file_attachment_id}.',
      handler: (a) => client.post(`/commercial_documents/${a.id}/appendices`, a.body) },
  );

  // ─── Purchases: Suppliers ──────────────────────────────────
  tools.push(...makeResourceTools(client, {
    name: "suppliers", path: "/suppliers", singular: "supplier", supports: { delete: false },
    createHints: '{name, emails:[], reg_no?, vat_number?, iban?, address:{address,postal_code,city,country:"FR"}, payment_conditions?:"30_days|60_days|on_receipt|...", phone?, external_reference?}',
    listHints: "name, external_reference, reg_no, updated_at",
  }));
  tools.push(
    { name: "supplier_categories_list", inputSchema: subListArgs, description: "List analytical categories of a supplier.",
      handler: subList(client, (id) => `/suppliers/${id}/categories`), readOnly: true },
    { name: "supplier_categories_set", inputSchema: z.object({ id: z.union([z.string(), z.number()]), body: z.record(z.any()) }),
      description: 'Set analytical categories on a supplier. BODY: {category_ids:[1,2,3]}. Replaces existing assignment.',
      handler: (a) => client.put(`/suppliers/${a.id}/categories`, a.body) },
    { name: "suppliers_changes_list", inputSchema: listArgsSchema, description: 'Incremental changelog for suppliers. Filter by updated_at for sync.',
      handler: (a) => client.get("/suppliers/changes", { "page[size]": a.page_size, "page[after]": a.page_after, filter: a.filter, sort: a.sort }), readOnly: true },
  );

  // ─── Purchases: Supplier Invoices ──────────────────────────
  tools.push(...makeResourceTools(client, {
    name: "supplier_invoices", path: "/supplier_invoices", singular: "supplier_invoice",
    supports: { create: false, delete: false }, description: "Use supplier_invoice_import_pdf (high-level) or supplier_invoice_import (raw)",
    updateHints: 'Editable fields: {supplier_id, date, deadline, invoice_number, currency_amount*, currency_amount_before_tax, currency_tax, invoice_lines, external_reference}',
    listHints: "status, date, deadline, supplier_id, external_reference, invoice_number, paid, updated_at",
  }));
  tools.push(
    { name: "supplier_invoice_import",
      description: 'Raw supplier invoice import (prefer supplier_invoice_import_pdf for the upload+import flow). BODY minimal: {file_attachment_id} — Pennylane does the OCR. BODY full: {file_attachment_id, supplier_id, date, deadline, invoice_number, currency_amount:"1200.00", currency_amount_before_tax:"1000.00", currency_tax:"200.00", invoice_lines:[{currency_amount, currency_tax, quantity, raw_currency_unit_price, unit, vat_rate, ledger_account_id}]}. 409 if file_attachment_id already imported.',
      inputSchema: z.object({ body: z.record(z.any()) }),
      handler: (a) => client.post("/supplier_invoices/import", a.body) },
    { name: "supplier_invoice_e_invoice_import",
      description: 'Attach a Factur-X/UBL/CII e-invoice XML to a supplier invoice. Upload XML via file_attachment_upload first. BODY: {file_attachment_id}.',
      inputSchema: z.object({ id: z.union([z.string(), z.number()]), body: z.record(z.any()) }),
      handler: (a) => client.post(`/supplier_invoices/${a.id}/e_invoice_import`, a.body) },
    { name: "supplier_invoice_validate_accounting",
      description: "Validate the accounting entry of an imported supplier invoice.",
      inputSchema: z.object({ id: z.union([z.string(), z.number()]) }),
      handler: (a) => client.put(`/supplier_invoices/${a.id}/validate_accounting`, {}) },
    { name: "supplier_invoice_payment_status_update",
      description: 'Update payment status. BODY: {paid:true|false} or {status:"paid|unpaid|partially_paid"}.',
      inputSchema: z.object({ id: z.union([z.string(), z.number()]), body: z.record(z.any()) }),
      handler: (a) => client.put(`/supplier_invoices/${a.id}/payment_status`, a.body) },
    { name: "supplier_invoice_link_purchase_request",
      description: 'Link a PO (purchase request) to a supplier invoice for 3-way matching. BODY: {purchase_request_id}.',
      inputSchema: z.object({ id: z.union([z.string(), z.number()]), body: z.record(z.any()) }),
      handler: (a) => client.post(`/supplier_invoices/${a.id}/linked_purchase_requests`, a.body) },
    { name: "supplier_invoice_categories_list", inputSchema: subListArgs, description: "List analytical categories.",
      handler: subList(client, (id) => `/supplier_invoices/${id}/categories`), readOnly: true },
    { name: "supplier_invoice_categories_set",
      inputSchema: z.object({ id: z.union([z.string(), z.number()]), body: z.record(z.any()) }),
      description: 'Set analytical categories on a supplier invoice. BODY: {category_ids:[1,2,3]}. Replaces existing assignment.',
      handler: (a) => client.put(`/supplier_invoices/${a.id}/categories`, a.body) },
    { name: "supplier_invoice_lines_list", inputSchema: subListArgs,
      description: "List invoice lines of a supplier invoice.",
      handler: subList(client, (id) => `/supplier_invoices/${id}/invoice_lines`), readOnly: true },
    { name: "supplier_invoice_payments_list", inputSchema: subListArgs,
      description: "List recorded payments of a supplier invoice.",
      handler: subList(client, (id) => `/supplier_invoices/${id}/payments`), readOnly: true },
    { name: "supplier_invoice_matched_transactions_list", inputSchema: subListArgs,
      description: "List bank transactions matched (reconciled) with a supplier invoice.",
      handler: subList(client, (id) => `/supplier_invoices/${id}/matched_transactions`), readOnly: true },
    { name: "supplier_invoice_match_transaction",
      description: "Match a bank transaction to a supplier invoice.",
      inputSchema: z.object({ id: z.union([z.string(), z.number()]), transaction_id: z.union([z.string(), z.number()]) }),
      handler: (a) => client.post(`/supplier_invoices/${a.id}/matched_transactions`, { transaction_id: a.transaction_id }) },
    { name: "supplier_invoice_unmatch_transaction",
      description: "Unmatch a bank transaction from a supplier invoice.",
      inputSchema: z.object({ id: z.union([z.string(), z.number()]), transaction_id: z.union([z.string(), z.number()]) }),
      handler: (a) => client.delete(`/supplier_invoices/${a.id}/matched_transactions/${a.transaction_id}`) },
    { name: "supplier_invoices_changes_list", inputSchema: listArgsSchema, description: 'Incremental changelog for supplier invoices. Filter by updated_at for sync.',
      handler: (a) => client.get("/supplier_invoices/changes", { "page[size]": a.page_size, "page[after]": a.page_after, filter: a.filter, sort: a.sort }), readOnly: true },
  );

  // ─── Purchases: Purchase Requests (read-only in v2) ────────
  tools.push(...makeResourceTools(client, {
    name: "purchase_requests", path: "/purchase_requests", singular: "purchase_request",
    supports: { create: false, update: false, delete: false },
    description: "Read-only in API v2 (no import/create endpoint). Purchase requests are created in the Pennylane UI.",
  }));

  // ─── Accounting: Journals ──────────────────────────────────
  tools.push(...makeResourceTools(client, {
    name: "journals", path: "/journals", singular: "journal",
    supports: { update: false, delete: false },
    description: "Accounting journals (HA=Achats, VE=Ventes, BQ=Banque, OD=Opérations Diverses, AN=À Nouveau)",
    createHints: '{code:"OD", label, journal_type:"purchases|sales|bank|miscellaneous|opening"}',
    listHints: "code, journal_type, label",
  }));

  // ─── Accounting: Ledger Accounts ───────────────────────────
  tools.push(...makeResourceTools(client, {
    name: "ledger_accounts", path: "/ledger_accounts", singular: "ledger_account",
    supports: { delete: false }, description: "French Chart of Accounts (PCG). 411=customers, 401=suppliers, 44571=VAT collected, 44566=VAT deductible, 706=services, 707=goods, 6xx=charges.",
    createHints: '{number:"706000", label:"Ventes de prestations"}',
    listHints: "number (use start_with for ranges), label",
  }));

  // ─── Accounting: Ledger Entries ────────────────────────────
  tools.push(...makeResourceTools(client, {
    name: "ledger_entries", path: "/ledger_entries", singular: "ledger_entry",
    supports: { delete: false },
    description: "Accounting entries — Σ debit MUST equal Σ credit, else 422",
    createHints: '{journal_id, date:"YYYY-MM-DD", deadline?, ledger_entry_lines:[{ledger_account_id, debit:"1000.00", credit:"0.00", label}, {ledger_account_id, debit:"0.00", credit:"1000.00", label}]}. Balance required.',
    listHints: "journal_id, date, updated_at",
  }));
  tools.push({
    name: "ledger_entry_lines_of_entry_list",
    inputSchema: subListArgs,
    description: "List lines of a ledger entry.",
    handler: subList(client, (id) => `/ledger_entries/${id}/ledger_entry_lines`),
    readOnly: true,
  });

  // ─── Accounting: Ledger Entry Lines ────────────────────────
  tools.push(
    { name: "ledger_entry_lines_list", description: "List all ledger entry lines.", inputSchema: listArgsSchema,
      handler: (a) => client.get("/ledger_entry_lines", { "page[size]": a.page_size, "page[after]": a.page_after, filter: a.filter, sort: a.sort }), readOnly: true },
    { name: "ledger_entry_line_get", description: "Get one ledger entry line.", inputSchema: z.object({ id: z.union([z.string(), z.number()]) }),
      handler: (a) => client.get(`/ledger_entry_lines/${a.id}`), readOnly: true },
    { name: "ledger_entry_line_lettered_lines", description: "Get the lines lettered with this one.",
      inputSchema: z.object({ id: z.union([z.string(), z.number()]) }),
      handler: (a) => client.get(`/ledger_entry_lines/${a.id}/lettered_ledger_entry_lines`), readOnly: true },
    { name: "ledger_entry_line_categories_list", description: "List analytical categories of a line.",
      inputSchema: z.object({ id: z.union([z.string(), z.number()]) }),
      handler: (a) => client.get(`/ledger_entry_lines/${a.id}/categories`), readOnly: true },
    { name: "ledger_entry_line_categories_set",
      description: 'Set analytical categories on a ledger entry line. BODY: {category_ids:[1,2,3]}. Replaces existing assignment.',
      inputSchema: z.object({ id: z.union([z.string(), z.number()]), body: z.record(z.any()) }),
      handler: (a) => client.put(`/ledger_entry_lines/${a.id}/categories`, a.body) },
    { name: "ledger_entry_lines_letter",
      description: "Letter (lettrer) accounting lines together — reconciles invoice ↔ payment on the same 411/401 account. REQUIREMENTS: all lines share the same ledger_account_id AND Σ(debit - credit) = 0. Returns 422 if violated.",
      inputSchema: z.object({ ledger_entry_line_ids: z.array(z.union([z.string(), z.number()])) }),
      handler: (a) => client.post("/ledger_entry_lines/lettering", { ledger_entry_line_ids: a.ledger_entry_line_ids }) },
    { name: "ledger_entry_lines_unletter",
      description: 'Un-letter (délettrer) previously lettered lines. BODY: {ledger_entry_line_ids:[1,2,3]} — pass the ids that were lettered together. Uses DELETE /ledger_entry_lines/lettering.',
      inputSchema: z.object({ body: z.record(z.any()) }),
      handler: (a) => client.request("DELETE", "/ledger_entry_lines/lettering", { body: a.body }) },
    { name: "ledger_entry_lines_changes_list", description: 'Incremental changelog for ledger entry lines. Filter by updated_at for sync.',
      inputSchema: listArgsSchema,
      handler: (a) => client.get("/ledger_entry_lines/changes", { "page[size]": a.page_size, "page[after]": a.page_after, filter: a.filter, sort: a.sort }), readOnly: true },
  );

  // ─── Accounting: Trial Balance & Fiscal Years ──────────────
  tools.push(
    { name: "trial_balance_get",
      description: 'Get the trial balance (balance des comptes comptables) for a period. Returns per-account totals of debit/credit. Requires scope trial_balance:readonly.',
      inputSchema: z.object({
        start_date: z.string().optional().describe('Period start, "YYYY-MM-DD"'),
        end_date: z.string().optional().describe('Period end, "YYYY-MM-DD"'),
        filter: listArgsSchema.shape.filter,
      }),
      handler: (a) => client.get("/trial_balance", { start_date: a.start_date, end_date: a.end_date, filter: a.filter }),
      readOnly: true },
    { name: "fiscal_years_list", description: "List fiscal years of the company.",
      inputSchema: z.object({ sort: z.string().optional().describe("Use '+start' to keep pre-2026 ordering") }),
      handler: (a) => client.get("/company/fiscal_years", { sort: a.sort }), readOnly: true },
  );

  // ─── Accounting: Exports ───────────────────────────────────
  tools.push(
    { name: "export_fec_create",
      description: 'Trigger async FEC export via POST /exports/fecs. BODY: {fiscal_year_id} OR {start_date:"YYYY-MM-DD", end_date:"YYYY-MM-DD"}. Returns {id, status:"pending"} — poll with export_fec_get, or use fec_export_and_wait.',
      inputSchema: z.object({ body: z.record(z.any()).optional() }),
      handler: (a) => client.post("/exports/fecs", a.body ?? {}) },
    { name: "export_fec_get",
      description: "Poll an FEC export by id (GET /exports/fecs/{id}). Returns status + file_url when completed.",
      inputSchema: z.object({ id: z.union([z.string(), z.number()]) }),
      handler: (a) => client.get(`/exports/fecs/${a.id}`), readOnly: true },
    { name: "export_agl_create",
      description: 'Trigger async Analytical General Ledger export via POST /exports/analytical_general_ledgers. BODY: {fiscal_year_id} OR {start_date, end_date}, optional {category_group_id}. Returns {id, status:"pending"} — poll with export_agl_get.',
      inputSchema: z.object({ body: z.record(z.any()).optional() }),
      handler: (a) => client.post("/exports/analytical_general_ledgers", a.body ?? {}) },
    { name: "export_agl_get",
      description: "Poll an AGL export by id (GET /exports/analytical_general_ledgers/{id}).",
      inputSchema: z.object({ id: z.union([z.string(), z.number()]) }),
      handler: (a) => client.get(`/exports/analytical_general_ledgers/${a.id}`), readOnly: true },
  );

  // ─── Banking ───────────────────────────────────────────────
  tools.push(...makeResourceTools(client, {
    name: "bank_accounts", path: "/bank_accounts", singular: "bank_account",
    supports: { update: false, delete: false },
    createHints: '{label, bank_establishment_id, iban, bic?, currency?:"EUR"}',
    listHints: "label, iban, bank_establishment_id",
  }));
  tools.push({
    name: "bank_establishments_list",
    description: "List known banking institutions.",
    inputSchema: listArgsSchema,
    handler: (a) => client.get("/bank_establishments", { "page[size]": a.page_size, "page[after]": a.page_after, filter: a.filter, sort: a.sort }),
    readOnly: true,
  });

  tools.push(...makeResourceTools(client, {
    name: "transactions", path: "/transactions", singular: "transaction",
    supports: { delete: false }, description: "Bank transactions",
    createHints: '{date:"YYYY-MM-DD", label, currency_amount:"-120.50" (negative=debit/outflow, positive=credit/inflow), bank_account_id, currency?:"EUR"}',
    listHints: "date, bank_account_id, reconciled (bool), matched (bool), currency_amount, label, updated_at",
  }));
  tools.push(
    { name: "transaction_matched_invoices_list", inputSchema: subListArgs, description: "List invoices matched to a transaction.",
      handler: subList(client, (id) => `/transactions/${id}/matched_invoices`), readOnly: true },
    { name: "transaction_categories_list", inputSchema: z.object({ id: z.union([z.string(), z.number()]) }),
      description: "List analytical categories of a transaction.",
      handler: (a) => client.get(`/transactions/${a.id}/categories`), readOnly: true },
    { name: "transaction_categories_set",
      inputSchema: z.object({ id: z.union([z.string(), z.number()]), body: z.record(z.any()) }),
      description: 'Set analytical categories on a bank transaction. BODY: {category_ids:[1,2,3]}. Replaces existing assignment.',
      handler: (a) => client.put(`/transactions/${a.id}/categories`, a.body) },
    { name: "transactions_changes_list", inputSchema: listArgsSchema, description: 'Incremental changelog for bank transactions. Filter by updated_at for sync.',
      handler: (a) => client.get("/transactions/changes", { "page[size]": a.page_size, "page[after]": a.page_after, filter: a.filter, sort: a.sort }), readOnly: true },
  );

  // ─── Categories (analytical) ───────────────────────────────
  tools.push(...makeResourceTools(client, {
    name: "categories", path: "/categories", singular: "category",
    supports: { delete: false },
    createHints: '{label, category_group_id, external_reference?}',
    listHints: "label, category_group_id",
  }));
  tools.push(
    { name: "category_groups_list", description: "List analytical category groups.", inputSchema: listArgsSchema,
      handler: (a) => client.get("/category_groups", { "page[size]": a.page_size, "page[after]": a.page_after, filter: a.filter, sort: a.sort }), readOnly: true },
    { name: "category_group_get", description: "Get one category group.", inputSchema: z.object({ id: z.union([z.string(), z.number()]) }),
      handler: (a) => client.get(`/category_groups/${a.id}`), readOnly: true },
    { name: "category_group_categories_list", inputSchema: subListArgs, description: "List categories of a group.",
      handler: subList(client, (id) => `/category_groups/${id}/categories`), readOnly: true },
  );

  // ─── Mandates (SEPA + GoCardless) ──────────────────────────
  tools.push(...makeResourceTools(client, {
    name: "sepa_mandates", path: "/sepa_mandates", singular: "sepa_mandate",
    supports: { delete: true },
    createHints: '{customer_id, iban, bic?, signed_at:"YYYY-MM-DD", reference?, sequence_type?:"recurring|one_off"}',
  }));
  tools.push(
    { name: "gocardless_mandates_list", description: "List GoCardless mandates.", inputSchema: listArgsSchema,
      handler: (a) => client.get("/gocardless_mandates", { "page[size]": a.page_size, "page[after]": a.page_after, filter: a.filter, sort: a.sort }), readOnly: true },
    { name: "gocardless_mandate_get", description: "Get a GoCardless mandate.", inputSchema: z.object({ id: z.union([z.string(), z.number()]) }),
      handler: (a) => client.get(`/gocardless_mandates/${a.id}`), readOnly: true },
    { name: "gocardless_mandate_mail_request",
      description: 'Email the GoCardless mandate signing link to the customer. BODY (optional): {to?:["x@y.com"], subject?, body?}. Omit for default template.',
      inputSchema: z.object({ id: z.union([z.string(), z.number()]), body: z.record(z.any()).optional() }),
      handler: (a) => client.post(`/gocardless_mandates/${a.id}/mail_requests`, a.body ?? {}) },
    { name: "gocardless_mandate_associate",
      description: 'Associate a GoCardless mandate with a customer (links an external GC mandate to a Pennylane customer). BODY: {customer_id}.',
      inputSchema: z.object({ id: z.union([z.string(), z.number()]), body: z.record(z.any()) }),
      handler: (a) => client.post(`/gocardless_mandates/${a.id}/associations`, a.body) },
    { name: "gocardless_mandate_cancel",
      description: 'Cancel a GoCardless mandate. BODY (optional): {reason?}.',
      inputSchema: z.object({ id: z.union([z.string(), z.number()]), body: z.record(z.any()).optional() }),
      handler: (a) => client.post(`/gocardless_mandates/${a.id}/cancellations`, a.body ?? {}) },
  );

  // ─── Billing Subscriptions ─────────────────────────────────
  tools.push(...makeResourceTools(client, {
    name: "billing_subscriptions", path: "/billing_subscriptions", singular: "billing_subscription",
    supports: { delete: false },
    createHints: '{customer_id, start_date, frequency:"monthly|quarterly|yearly|...", invoice_lines:[{label, quantity, raw_currency_unit_price, vat_rate, unit}], end_date?, payment_method?, external_reference?}',
    listHints: "customer_id, status, start_date, frequency",
  }));
  tools.push(
    { name: "billing_subscription_invoice_lines_list", inputSchema: subListArgs, description: "Invoice lines of a subscription.",
      handler: subList(client, (id) => `/billing_subscriptions/${id}/invoice_lines`), readOnly: true },
    { name: "billing_subscription_invoice_line_sections_list", inputSchema: subListArgs, description: "Sections of subscription lines.",
      handler: subList(client, (id) => `/billing_subscriptions/${id}/invoice_line_sections`), readOnly: true },
  );

  // ─── File Attachments ──────────────────────────────────────
  tools.push(
    { name: "file_attachment_upload",
      description: "Upload a file (PDF, image). Pass content as base64. Returns {id} to use in imports.",
      inputSchema: z.object({
        filename: z.string(),
        content_base64: z.string().describe("File content encoded as base64"),
      }),
      handler: (a) => client.upload("/file_attachments", a.content_base64 as string, a.filename as string, "file") },
    { name: "ledger_attachment_upload",
      description: "Upload a file to attach to a ledger entry.",
      inputSchema: z.object({
        filename: z.string(),
        content_base64: z.string(),
        ledger_entry_id: z.union([z.string(), z.number()]).optional(),
      }),
      handler: (a) => client.upload(
        "/ledger_attachments",
        a.content_base64 as string,
        a.filename as string,
        "file",
        a.ledger_entry_id ? { ledger_entry_id: String(a.ledger_entry_id) } : {},
      ) },
  );

  // ─── Generic escape hatch ──────────────────────────────────
  tools.push({
    name: "pennylane_raw_request",
    description: "Escape hatch: call any Pennylane endpoint directly. Use only when no dedicated tool exists.",
    inputSchema: z.object({
      method: z.enum(["GET", "POST", "PUT", "DELETE", "PATCH"]),
      path: z.string().describe("Path starting with / (e.g. /customers)"),
      query: z.record(z.any()).optional(),
      body: z.record(z.any()).optional(),
    }),
    handler: (a) => client.request(a.method as string, a.path as string, { query: a.query as Record<string, unknown> | undefined, body: a.body }),
  });

  return tools;
}
