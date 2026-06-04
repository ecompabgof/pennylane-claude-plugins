import { describe, it, expect } from "vitest";
import { filterToolsByScope } from "./scope.js";
import type { McpTool } from "./tools/factory.js";
import { z } from "zod";

const t = (name: string, readOnly?: boolean): McpTool => ({
  name,
  description: name,
  inputSchema: z.object({}),
  handler: async () => ({}),
  readOnly,
});

const tools = [t("a_list", true), t("a_get", true), t("a_create", false), t("raw", undefined)];

describe("filterToolsByScope", () => {
  it("full returns everything", () => {
    expect(filterToolsByScope(tools, "full")).toHaveLength(4);
  });
  it("read returns only readOnly===true (default-deny)", () => {
    const r = filterToolsByScope(tools, "read").map((x) => x.name);
    expect(r).toEqual(["a_list", "a_get"]);
  });
});
