// src/mcp/tools/types.ts — the shared ToolDef shape + defensive arg helpers for truffle's MCP tools.
//
// MCP args arrive UNTRUSTED over the JSON-RPC wire (a sibling agent — or a malicious one — supplies them), so
// every handler validates its inputs through these helpers rather than trusting the shape. This is the same
// discipline acorn/hush use; truffle adds the search-vertical agent-operator rules in the handler bodies
// (untrusted returned content, poll-the-Meili-task-queue, POST-for-complex-filters — brain P25/P1/P4).

/** A JSON-RPC tool definition surfaced by `tools/list` and dispatched by `tools/call`. */
export interface ToolDef {
  readonly name: string;
  readonly description: string;
  /** A minimal JSON Schema for the tool's arguments (object/properties/required). */
  readonly inputSchema: Readonly<Record<string, unknown>>;
  /** The handler: validated args in, a JSON-serialisable result out. Throws on bad args (→ tool-level error). */
  readonly handler: (args: Record<string, unknown>) => unknown;
}

/** Require a string arg. */
export function str(args: Record<string, unknown>, key: string): string {
  const v = args[key];
  if (typeof v !== "string") throw new Error(`'${key}' must be a string`);
  return v;
}

/** Optional string arg with a default. */
export function optStr(args: Record<string, unknown>, key: string, dflt: string): string {
  const v = args[key];
  return typeof v === "string" ? v : dflt;
}

/** Require a number arg (accepts a numeric string too — agents often pass "500000"). */
export function num(args: Record<string, unknown>, key: string): number {
  const v = args[key];
  const n = typeof v === "number" ? v : Number.parseInt(String(v), 10);
  if (!Number.isFinite(n)) throw new Error(`'${key}' must be a number`);
  return n;
}

/** Optional number arg; returns undefined when absent/unparseable (the "no value" path the cores expect). */
export function optNum(args: Record<string, unknown>, key: string): number | undefined {
  const v = args[key];
  if (v === undefined || v === null) return undefined;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : undefined;
}

/** Optional boolean arg with a default. */
export function optBool(args: Record<string, unknown>, key: string, dflt: boolean): boolean {
  const v = args[key];
  return typeof v === "boolean" ? v : dflt;
}

/** Optional string-array arg (e.g. `path` or `facet` which may be a string or string[]). */
export function optStrArray(args: Record<string, unknown>, key: string): string[] | undefined {
  const v = args[key];
  if (typeof v === "string") return [v];
  if (Array.isArray(v) && v.every((x) => typeof x === "string")) return v as string[];
  return undefined;
}
