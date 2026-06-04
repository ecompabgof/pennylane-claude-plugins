import { describe, it, expect } from "vitest";
import { filterToolsByDomain, domainOf } from "./domains.js";
import { buildAllTools } from "./tools/registry.js";
import { PennylaneClient } from "./client.js";

const tools = buildAllTools(new PennylaneClient({ token: "test" }));
const DOMS = ["ventes", "achats", "compta", "banque", "divers"] as const;

describe("filterToolsByDomain", () => {
  it("full returns every tool", () => {
    expect(filterToolsByDomain(tools, "full").length).toBe(tools.length);
  });
  it("each domain is a non-empty strict subset", () => {
    for (const d of DOMS) {
      const n = filterToolsByDomain(tools, d).length;
      expect(n, `${d} empty`).toBeGreaterThan(0);
      expect(n).toBeLessThan(tools.length);
    }
  });
  it("the 5 domains partition ALL tools (no orphan, no overlap)", () => {
    const sum = DOMS.reduce((s, d) => s + filterToolsByDomain(tools, d).length, 0);
    const orphans = tools.filter((t) => domainOf(t.name) === null).map((t) => t.name);
    expect(orphans, `orphans: ${orphans.join(", ")}`).toEqual([]);
    expect(sum).toBe(tools.length);
  });
  it("known tools land in the right theme", () => {
    expect(domainOf("customer_invoices_list")).toBe("ventes");
    expect(domainOf("supplier_invoice_get")).toBe("achats");
    expect(domainOf("ledger_entries_list")).toBe("compta");
    expect(domainOf("transactions_list")).toBe("banque");
    expect(domainOf("pennylane_raw_request")).toBe("divers");
  });
});
