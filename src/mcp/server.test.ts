// src/mcp/server.test.ts — the MCP contract test (C1 verify).
//
// Asserts: tools/list returns EXACTLY the 11 §4 tools with the right names; the deterministic tools round-trip to
// real structured results through the SAME cores the CLI uses; and the engine-touching tools are HONEST.
//
// NOTE (post-Cluster-E): the engine-touching tools (index/search/eval/doctor) now delegate to the real
// src/runtime/* modules — E landed, so they're WIRED (no longer wired:false "not found"). To keep this contract
// deterministic in the build-test CI job (no Meili service — only the acceptance job has one), we point the engine
// at an unreachable URL: the runtime makes a REAL attempt, fails honestly, and delegateOrExplain returns
// {wired:true, error} with NO fabricated hits. The live-Meili round-trip (real hits) is proven by the acceptance
// suite (eval-suite + acceptance.yml). The post-E invariant asserted here: the tool is WIRED and NEVER fabricates
// a hits array / eval verdict when the engine is down.

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { TOOLS, TOOL_BY_NAME } from "./tools/index.js";

// Force an unreachable engine so the engine-touching contract is deterministic regardless of a running Meili.
const PRIOR_URL = process.env.MEILI_URL;
beforeAll(() => {
  process.env.MEILI_URL = "http://127.0.0.1:9"; // discard port — never a Meili; health() returns false fast.
});
afterAll(() => {
  if (PRIOR_URL === undefined) delete process.env.MEILI_URL;
  else process.env.MEILI_URL = PRIOR_URL;
});

const EXPECTED_NAMES = [
  "truffle_index",
  "truffle_search",
  "truffle_engine_select",
  "truffle_hybrid_design",
  "truffle_facet_plan",
  "truffle_rerank_advise",
  "truffle_embed_advise",
  "truffle_tenant_key",
  "truffle_eval",
  "truffle_doctor",
  "truffle_brain_search",
];

describe("truffle MCP tool surface (§4)", () => {
  it("exposes exactly 11 tools", () => {
    expect(TOOLS).toHaveLength(11);
    expect(TOOL_BY_NAME.size).toBe(11);
  });

  it("the tool names match the §4 list in order", () => {
    expect(TOOLS.map((t) => t.name)).toEqual(EXPECTED_NAMES);
  });

  it("every tool has a description + inputSchema (the tools/list shape)", () => {
    for (const t of TOOLS) {
      expect(typeof t.description).toBe("string");
      expect(t.description.length).toBeGreaterThan(20);
      expect(t.inputSchema).toMatchObject({ type: "object" });
    }
  });
});

describe("deterministic tools round-trip to real results (one source of truth with the CLI)", () => {
  it("truffle_engine_select reproduces the B2 contract case → typesense", () => {
    const tool = TOOL_BY_NAME.get("truffle_engine_select")!;
    const r = tool.handler({ corpus_size: 500000, multitenant: true }) as { engine: string; reason: string };
    expect(r.engine).toBe("typesense");
    expect(r.reason).toMatch(/multi-tenan|latency|O11/i);
  });

  it("truffle_hybrid_design emits the per-engine template + fusion note", () => {
    const tool = TOOL_BY_NAME.get("truffle_hybrid_design")!;
    const r = tool.handler({ engine: "meili" }) as { query_template: string; fusion_note: string };
    expect(r.query_template).toMatch(/semanticRatio/);
    expect(r.fusion_note).toMatch(/floor|golden|O5/i);
  });

  it("truffle_facet_plan flags a high-cardinality facet as a systems problem", () => {
    const tool = TOOL_BY_NAME.get("truffle_facet_plan")!;
    const r = tool.handler({ field: "brand", cardinality: 2_000_000 }) as { safe: boolean; dials: unknown[] };
    expect(r.safe).toBe(false);
    expect(r.dials.length).toBeGreaterThan(1);
  });

  it("truffle_rerank_advise SKIPS when MRR@5 already > 0.85", () => {
    const tool = TOOL_BY_NAME.get("truffle_rerank_advise")!;
    const r = tool.handler({ mrr_at_5: 0.9 }) as { decision: string };
    expect(r.decision).toBe("skip");
  });

  it("truffle_embed_advise flags 3-large (3072d) over the 2000 float32 cap", () => {
    const tool = TOOL_BY_NAME.get("truffle_embed_advise")!;
    const r = tool.handler({ index_cap: 2000 }) as { overCap: string[]; goldenSetRequired: boolean };
    expect(r.overCap).toContain("openai/text-embedding-3-large");
    expect(r.goldenSetRequired).toBe(true);
  });

  it("truffle_tenant_key emits a server-enforced key (never the client filter)", () => {
    const tool = TOOL_BY_NAME.get("truffle_tenant_key")!;
    const r = tool.handler({ filter: "tenant_id = 42", engine: "typesense" }) as { server_enforced: boolean; guidance: string };
    expect(r.server_enforced).toBe(true);
    expect(r.guidance).toMatch(/HMAC|signed key/i);
  });

  it("truffle_brain_search returns ranked brain hits (S4 → BATTLE-TESTED-SCENARIOS)", () => {
    const tool = TOOL_BY_NAME.get("truffle_brain_search")!;
    const r = tool.handler({ query: "filtered ANN under-return" }) as { hits: Array<{ file: string }> };
    expect(r.hits.length).toBeGreaterThan(0);
    expect(r.hits[0]!.file).toMatch(/BATTLE-TESTED-SCENARIOS/);
  });
});

describe("engine-touching tools are HONEST (post-E: wired, but NEVER fabricate without a live engine)", () => {
  it("truffle_search is WIRED (not wired:false) and returns NO fabricated hits when the engine is down", async () => {
    const tool = TOOL_BY_NAME.get("truffle_search")!;
    const r = (await tool.handler({ query: "kubernetes" })) as { wired?: boolean; hits?: unknown; error?: string };
    // Post-E: the module loads → NOT the wired:false "not found" path. With the engine forced-unreachable, the
    // runtime errors honestly → wired:true + an error, and CRUCIALLY no fabricated hits array.
    expect(r.wired).not.toBe(false);
    expect(r.hits).toBeUndefined(); // crucially: NO fabricated hits when the engine is down
    if (r.wired === true) expect(typeof r.error).toBe("string"); // honest error, not a fake success
  });

  it("truffle_index, truffle_eval, truffle_doctor are WIRED and never fabricate a result with the engine down", async () => {
    for (const name of ["truffle_index", "truffle_eval", "truffle_doctor"]) {
      const tool = TOOL_BY_NAME.get(name)!;
      const args = name === "truffle_index" ? { path: "./fixtures/corpus" } : {};
      const r = (await tool.handler(args)) as { wired?: boolean; indexed?: unknown; recall_at_10?: unknown };
      expect(r.wired).not.toBe(false); // wired now (E landed) — not the not-found path
      // No fabricated success fields when the engine is unreachable.
      expect(r.indexed).toBeUndefined();
      expect(r.recall_at_10).toBeUndefined();
    }
  });
});
