import { Buffer } from "node:buffer";

export interface PennylaneClientOptions {
  token: string;
  baseUrl?: string;
  use2026Api?: boolean;
}

export class PennylaneError extends Error {
  constructor(
    public status: number,
    public body: unknown,
    message: string,
  ) {
    super(message);
    this.name = "PennylaneError";
  }
}

export class PennylaneClient {
  private readonly token: string;
  private readonly baseUrl: string;
  private readonly use2026Api: boolean;

  constructor(opts: PennylaneClientOptions) {
    if (!opts.token) throw new Error("PENNYLANE_API_TOKEN is required");
    this.token = opts.token;
    this.baseUrl = (opts.baseUrl ?? "https://app.pennylane.com/api/external/v2").replace(/\/$/, "");
    this.use2026Api = opts.use2026Api ?? false;
  }

  private headers(extra: Record<string, string> = {}): Record<string, string> {
    const h: Record<string, string> = {
      Authorization: `Bearer ${this.token}`,
      Accept: "application/json",
      ...extra,
    };
    if (this.use2026Api) h["X-Use-2026-API-Changes"] = "true";
    return h;
  }

  private buildUrl(path: string, query?: Record<string, unknown>): string {
    const url = new URL(this.baseUrl + (path.startsWith("/") ? path : `/${path}`));
    if (query) {
      for (const [k, v] of Object.entries(query)) {
        if (v === undefined || v === null) continue;
        if (typeof v === "object") url.searchParams.set(k, JSON.stringify(v));
        else url.searchParams.set(k, String(v));
      }
    }
    return url.toString();
  }

  async request<T = unknown>(
    method: string,
    path: string,
    opts: { query?: Record<string, unknown>; body?: unknown; headers?: Record<string, string> } = {},
  ): Promise<T> {
    const url = this.buildUrl(path, opts.query);
    const isMultipart = opts.body instanceof FormData;
    const init: RequestInit = {
      method,
      headers: this.headers(
        isMultipart ? (opts.headers ?? {}) : { "Content-Type": "application/json", ...(opts.headers ?? {}) },
      ),
    };
    if (opts.body !== undefined) {
      init.body = isMultipart ? (opts.body as FormData) : JSON.stringify(opts.body);
    }

    const res = await fetch(url, init);
    const text = await res.text();
    let parsed: unknown = text;
    if (text && res.headers.get("content-type")?.includes("application/json")) {
      try { parsed = JSON.parse(text); } catch { /* keep raw */ }
    }

    if (!res.ok) {
      const msg =
        (parsed && typeof parsed === "object" && "message" in parsed && typeof parsed.message === "string")
          ? parsed.message
          : `HTTP ${res.status} on ${method} ${path}`;
      throw new PennylaneError(res.status, parsed, msg);
    }
    return parsed as T;
  }

  // Convenience wrappers
  get<T = unknown>(path: string, query?: Record<string, unknown>) { return this.request<T>("GET", path, { query }); }
  post<T = unknown>(path: string, body?: unknown) { return this.request<T>("POST", path, { body }); }
  put<T = unknown>(path: string, body?: unknown) { return this.request<T>("PUT", path, { body }); }
  delete<T = unknown>(path: string) { return this.request<T>("DELETE", path); }

  // File upload (multipart)
  async upload<T = unknown>(path: string, fileBase64: string, filename: string, fieldName = "file", extraFields: Record<string, string> = {}): Promise<T> {
    const form = new FormData();
    const buf = Buffer.from(fileBase64, "base64");
    const blob = new Blob([new Uint8Array(buf)]);
    form.append(fieldName, blob, filename);
    for (const [k, v] of Object.entries(extraFields)) form.append(k, v);
    return this.request<T>("POST", path, { body: form });
  }
}
