import { describe, it, expect } from "vitest";
import { createMcpServer } from "./server.js";
import { PennylaneClient } from "./client.js";

const client = new PennylaneClient({ token: "test" });

describe("createMcpServer", () => {
  it("read scope exposes fewer tools than full", () => {
    const full = createMcpServer(client, { scope: "full" });
    const read = createMcpServer(client, { scope: "read" });
    expect(read.toolCount).toBeGreaterThan(0);
    expect(read.toolCount).toBeLessThan(full.toolCount);
  });
  it("returns a connectable server object", () => {
    const { server } = createMcpServer(client, { scope: "read" });
    expect(typeof server.connect).toBe("function");
  });
});
