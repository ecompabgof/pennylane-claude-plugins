import type { McpTool } from "./tools/factory.js";

/** Thème métier — chaque plugin Pennylane n'expose qu'un domaine (moins d'outils = moins d'erreurs). */
export type Domain = "ventes" | "achats" | "compta" | "banque" | "divers" | "full";
export const DOMAINS: Domain[] = ["ventes", "achats", "compta", "banque", "divers", "full"];

// Un domaine = règles sur les noms de tools. Premier domaine qui matche gagne (ordre = priorité).
const DOMAIN_PATTERNS: Record<Exclude<Domain, "full">, RegExp[]> = {
  ventes: [/^customer/, /^product/, /^quote/, /^commercial_document/],
  achats: [/^supplier/, /^purchase_request/],
  compta: [/^journal/, /^ledger/, /^trial_balance/, /^fiscal_year/, /^export_(fec|agl)/, /^fec_export/],
  banque: [/^bank/, /^transaction/, /^sepa/, /^gocardless/],
  divers: [/^categor/, /^billing_subscription/, /^file_attachment/, /^me$/, /^pennylane_/],
};

/** Renvoie le domaine d'un tool (1er match dans l'ordre), ou null si aucun. */
export function domainOf(name: string): Exclude<Domain, "full"> | null {
  for (const d of ["ventes", "achats", "compta", "banque", "divers"] as const) {
    if (DOMAIN_PATTERNS[d].some((re) => re.test(name))) return d;
  }
  return null;
}

/** Filtre les tools par domaine. "full" = tous. Domaine inconnu géré en amont (cf. index.ts). */
export function filterToolsByDomain(tools: McpTool[], domain: Domain): McpTool[] {
  if (domain === "full") return tools;
  return tools.filter((t) => domainOf(t.name) === domain);
}
