import type { McpTool } from "./tools/factory.js";

export type Scope = "full" | "read";

/**
 * Filtre les tools selon le scope.
 * - "full" : tous les tools.
 * - "read" : ALLOWLIST — uniquement les tools explicitement tagués readOnly===true.
 *   Default-deny : un tool non tagué (write, raw_request, futur tool) est exclu.
 */
export function filterToolsByScope(tools: McpTool[], scope: Scope): McpTool[] {
  if (scope === "full") return tools;
  return tools.filter((t) => t.readOnly === true);
}
