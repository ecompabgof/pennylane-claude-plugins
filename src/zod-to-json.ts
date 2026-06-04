import type { ZodTypeAny } from "zod";
import { zodToJsonSchema as base } from "zod-to-json-schema";

export function zodToJsonSchema(schema: ZodTypeAny): Record<string, unknown> {
  const out = base(schema, { target: "jsonSchema7", $refStrategy: "none" }) as Record<string, unknown>;
  delete (out as { $schema?: unknown }).$schema;
  if (!out.type) out.type = "object";
  return out;
}
