import { describe, it, expect } from "vitest";
import { makeResourceTools } from "./factory.js";
import { PennylaneClient } from "../client.js";
import { buildAllTools } from "./registry.js";

const client = new PennylaneClient({ token: "test" });

describe("makeResourceTools readOnly tagging", () => {
  const tools = makeResourceTools(client, {
    name: "things",
    path: "/things",
    singular: "thing",
    supports: { list: true, get: true, create: true, update: true, delete: true },
  });
  const byName = (n: string) => tools.find((t) => t.name === n);

  it("tags list as readOnly", () => {
    expect(byName("things_list")?.readOnly).toBe(true);
  });
  it("tags get as readOnly", () => {
    expect(byName("thing_get")?.readOnly).toBe(true);
  });
  it("does NOT tag create/update/delete as readOnly", () => {
    expect(byName("thing_create")?.readOnly).toBeFalsy();
    expect(byName("thing_update")?.readOnly).toBeFalsy();
    expect(byName("thing_delete")?.readOnly).toBeFalsy();
  });
});

describe("buildAllTools read tagging", () => {
  const tools = buildAllTools(new PennylaneClient({ token: "test" }));
  const ro = (n: string) => tools.find((t) => t.name === n)?.readOnly;

  it("tags me as readOnly", () => expect(ro("me")).toBe(true));
  it("tags docs_search as readOnly", () => expect(ro("pennylane_docs_search")).toBe(true));
  it("tags customers_list as readOnly", () => expect(ro("customers_list")).toBe(true));
  it("does NOT tag customer_create as readOnly", () => expect(ro("customer_create")).toBeFalsy());

  it("includes inline pure-GET tools in read scope", () => {
    expect(ro("trial_balance_get")).toBe(true);
    expect(ro("fiscal_years_list")).toBe(true);
    expect(ro("ledger_entry_line_get")).toBe(true);
    expect(ro("gocardless_mandates_list")).toBe(true);
    expect(ro("bank_establishments_list")).toBe(true);
    expect(ro("customer_invoices_changes_list")).toBe(true);
    expect(ro("transactions_changes_list")).toBe(true);
    expect(ro("category_group_get")).toBe(true);
    expect(ro("export_fec_get")).toBe(true);
    expect(ro("billing_subscription_invoice_lines_list")).toBe(true);
  });
  it("never tags writes or raw_request", () => {
    expect(ro("customer_create")).toBeFalsy();
    expect(ro("pennylane_raw_request")).toBeFalsy();
    expect(ro("supplier_invoice_import")).toBeFalsy();
    expect(ro("export_fec_create")).toBeFalsy();
    expect(ro("ledger_entry_lines_letter")).toBeFalsy();
  });
});
