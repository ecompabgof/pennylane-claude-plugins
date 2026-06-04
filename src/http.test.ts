import { describe, it, expect } from "vitest";
import request from "supertest";
import { createHttpApp } from "./http.js";
import { PennylaneClient } from "./client.js";

const app = createHttpApp({
  client: new PennylaneClient({ token: "dummy" }),
  scope: "read",
  authToken: "secret",
});

const rpc = { jsonrpc: "2.0", method: "tools/list", id: 1 };

describe("http auth gate", () => {
  it("401 when bearer is missing", async () => {
    const res = await request(app).post("/mcp").send(rpc);
    expect(res.status).toBe(401);
  });
  it("401 when bearer is wrong", async () => {
    const res = await request(app).post("/mcp").set("Authorization", "Bearer nope").send(rpc);
    expect(res.status).toBe(401);
  });
  it("health endpoint is open (200)", async () => {
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });
  it("does not 401 a request with a valid bearer", async () => {
    const initialize = {
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2025-06-18",
        capabilities: {},
        clientInfo: { name: "test", version: "0.0.0" },
      },
    };
    const res = await request(app)
      .post("/mcp")
      .set("Authorization", "Bearer secret")
      .set("Accept", "application/json, text/event-stream")
      .set("Content-Type", "application/json")
      .send(initialize);
    expect(res.status).not.toBe(401);
  });
});
