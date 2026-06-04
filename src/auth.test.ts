import { describe, it, expect } from "vitest";
import { checkBearer } from "./auth.js";

describe("checkBearer", () => {
  it("accepts a correct bearer", () => {
    expect(checkBearer("Bearer secret123", "secret123")).toBe(true);
  });
  it("is case-insensitive on the scheme", () => {
    expect(checkBearer("bearer secret123", "secret123")).toBe(true);
  });
  it("rejects a wrong token", () => {
    expect(checkBearer("Bearer nope", "secret123")).toBe(false);
  });
  it("rejects a missing header", () => {
    expect(checkBearer(undefined, "secret123")).toBe(false);
  });
  it("rejects when expected is empty", () => {
    expect(checkBearer("Bearer anything", "")).toBe(false);
  });
  it("rejects a header without the Bearer scheme", () => {
    expect(checkBearer("secret123", "secret123")).toBe(false);
  });
  it("tolerates extra spaces after the scheme", () => {
    expect(checkBearer("Bearer  secret123", "secret123")).toBe(true);
  });
  it("tolerates trailing whitespace in the expected secret (env artifact)", () => {
    expect(checkBearer("Bearer secret123", "secret123 ")).toBe(true);
  });
});
