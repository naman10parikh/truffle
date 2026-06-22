// src/mcp/tools/index.ts — truffle's 11 MCP tools assembled (the §4 MCP tool list) + the name→tool lookup.
//
// The order is the PLAN §4 order: index · search · engine_select · hybrid_design · facet_plan · rerank_advise ·
// embed_advise · tenant_key · eval · doctor · brain_search. Seven are deterministic (run real results now);
// four are engine-touching (honest not-wired delegation until Cluster E lands). This is truffle's OWN server's
// tool surface — NOT the inherited 4-server template, NOT a passthrough to the official Meili MCP.

import { DETERMINISTIC_TOOLS } from "./deterministic.js";
import { RUNTIME_TOOLS } from "./runtime-tools.js";
import type { ToolDef } from "./types.js";

// Assemble in the canonical PLAN §4 order (index/search first — they ARE the acceptance bar — then the
// deterministic advisors, then eval/doctor, then brain). A Map preserves quick name→tool dispatch for the server.
const byName = new Map<string, ToolDef>();
for (const t of [...DETERMINISTIC_TOOLS, ...RUNTIME_TOOLS]) byName.set(t.name, t);

/** The canonical, ordered 11-tool list `tools/list` returns. */
export const TOOLS: ToolDef[] = [
  byName.get("truffle_index")!,
  byName.get("truffle_search")!,
  byName.get("truffle_engine_select")!,
  byName.get("truffle_hybrid_design")!,
  byName.get("truffle_facet_plan")!,
  byName.get("truffle_rerank_advise")!,
  byName.get("truffle_embed_advise")!,
  byName.get("truffle_tenant_key")!,
  byName.get("truffle_eval")!,
  byName.get("truffle_doctor")!,
  byName.get("truffle_brain_search")!,
];

/** name → ToolDef for `tools/call` dispatch. */
export const TOOL_BY_NAME: Map<string, ToolDef> = new Map(TOOLS.map((t) => [t.name, t]));

export type { ToolDef } from "./types.js";
