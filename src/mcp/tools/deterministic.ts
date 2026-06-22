// src/mcp/tools/deterministic.ts — the 7 PURE-CODE truffle MCP tools (no engine, no LLM, no network).
//
// These wrap the SAME deterministic cores the CLI calls (src/core/* + the CLI's tenant/hybrid-template/rerank
// logic) so the MCP and the CLI are ONE source of truth — a sibling agent calling `truffle_engine_select` gets
// byte-identical results to `truffle engine select --json`. They run + return real structured results NOW
// (they have no unbuilt dependency). Source: PLAN §4 MCP tool list + the B3 cores + the B2 CLI command bodies.

import { selectEngine, type EngineSelectInput } from "../../core/engine-selector.js";
import { rrf, tieredFuse, type RankList, type Tier } from "../../core/fusion.js";
import { planFacet } from "../../core/facet-dial.js";
import { adviseEmbedder, type IndexCap } from "../../core/embed-dims.js";
import { runBrainSearch } from "../../cli/commands/brain.js";
import { num, optNum, optBool, optStr, str } from "./types.js";
import type { ToolDef } from "./types.js";

// Per-engine hybrid query templates — kept in lockstep with src/cli/commands/hybrid.ts (JTBD-2.7). Duplicated
// intentionally small here so the MCP has no import cycle through the CLI's commander registration; both encode
// the same per-engine syntax + the O5 "RRF is the floor, tune on a golden set" fusion note.
const HYBRID_TEMPLATES: Record<string, { template: string; fusionNote: string }> = {
  meili: {
    template: `POST /indexes/{index}/search\n{ "q": "{query}", "hybrid": { "embedder": "default", "semanticRatio": 0.5 } }`,
    fusionNote:
      "Meili fuses keyword+vector internally via semanticRatio (hybrid-on-by-default in 2026); tune the ratio on a golden set, don't stop at 0.5 (O5).",
  },
  typesense: {
    template: `GET /collections/{c}/documents/search\n  ?q={query}&query_by=embedding,title,body&vector_query=embedding:([], k:100)`,
    fusionNote:
      "Typesense auto-fuses when query_by spans a vector field + text fields; the cleanest hybrid API. RRF under the hood — tune query_by weights on a golden set (O5). NOTE v28 #2365: hybrid + symbols_to_index over code fields scores wrong — test the exact version (P16).",
  },
  es: {
    template: `POST /{index}/_search\n{ "retriever": { "rrf": { "retrievers": [ {"standard":{"query":{"match":{"body":"{query}"}}}}, {"knn":{"field":"embedding","query_vector":[...],"k":100}} ], "rank_constant": 60 } } }`,
    fusionNote: "ES rrf retriever fuses a BM25 standard retriever + a knn retriever; rank_constant=60 is the floor — boost on top (O5).",
  },
  postgres: {
    template: `WITH bm25 AS (SELECT id, ts_rank_cd(...) r FROM docs WHERE tsv @@ plainto_tsquery('{query}') ORDER BY r DESC LIMIT 100),\n     vec AS (SELECT id, 1-(embedding <=> '{qvec}') r FROM docs ORDER BY embedding <=> '{qvec}' LIMIT 100)\nSELECT id, COALESCE(1.0/(60+bm25.rrk),0)+COALESCE(1.0/(60+vec.vrk),0) score FROM ... ORDER BY score DESC;`,
    fusionNote:
      "pgvector has NO built-in fusion — you hand-roll the two-CTE RRF (k=60). Needs pgvector ≥ 0.8 + hnsw.iterative_scan for correct filtered-ANN (P17/S4). The DB is acorn's; the iterative-scan SETTING is truffle's.",
  },
};

/** The reranker ADD/SKIP rule (O6/S6) — identical logic to `truffle rerank advise`, returned as structured JSON. */
function rerankAdvise(args: Record<string, unknown>): { decision: "add" | "skip"; reason: string; model?: string } {
  const mrr = optNum(args, "mrr_at_5");
  const budget = optNum(args, "latency_budget_ms");
  const surface = optStr(args, "surface", "search");
  if (mrr !== undefined && mrr > 0.85) {
    return { decision: "skip", reason: `MRR@5 is already ${mrr} (> 0.85) — reranking a near-perfect set is pure latency cost (O6/S6).` };
  }
  if (budget !== undefined && budget < 100) {
    return { decision: "skip", reason: `Latency budget ${budget}ms can't absorb a cross-encoder pass (+100-500ms) — wrong on autocomplete (S6).` };
  }
  return {
    decision: "add",
    reason: `Reranking the top-100 is the biggest single quality lever (+5-15 NDCG@10, +20-35% RAG accuracy) on ${surface} (O6). Vendor benchmarks are marketing — eval on your golden set (P12).`,
    model: "cohere-rerank-3.5 (managed) or bge-reranker-v2 on a GPU (zero marginal cost, O10)",
  };
}

/** The server-enforced tenant-key rule (O23/S7) — identical to `truffle tenant key`, returned as structured JSON. */
function tenantKey(args: Record<string, unknown>): {
  server_enforced: true;
  engine: "typesense" | "meili";
  filter: string;
  guidance: string;
} {
  const filter = str(args, "filter");
  const engine = str(args, "engine");
  if (engine !== "typesense" && engine !== "meili") {
    throw new Error(`tenant key supports typesense|meili (got "${engine}")`);
  }
  const guidance =
    engine === "typesense"
      ? `Typesense: derive a SCOPED SEARCH KEY via HMAC of a parent search-only key + {"filter_by":"${filter}"}. The filter is embedded in the signed key — the client cannot remove it.`
      : `Meili: mint a TENANT TOKEN signed with an API key, with searchRules {"*":{"filter":"${filter}"}}. The filter rides inside the JWT — the client cannot strip it.`;
  return { server_enforced: true, engine, filter, guidance };
}

/** The 7 deterministic tools. Each handler is pure — same args → same result, no engine/LLM/network. */
export const DETERMINISTIC_TOOLS: ToolDef[] = [
  {
    name: "truffle_engine_select",
    description:
      "Corpus-size/control decision tree → engine + honest cost + right-size verdict (Meili default; Typesense for latency/multitenancy; Postgres for one-fewer-service; never ES-by-default; never Algolia-for-an-agent). Pure code.",
    inputSchema: {
      type: "object",
      properties: {
        corpus_size: { type: "number", description: "document count in the corpus (the primary routing axis, O11)" },
        multitenant: { type: "boolean", description: "multi-tenant product (per-tenant scoped search)" },
        latency_critical: { type: "boolean", description: "sub-50ms / autocomplete latency requirement" },
        on_postgres: { type: "boolean", description: "already running Postgres (one-fewer-service path)" },
        offline: { type: "boolean", description: "offline corpus an agent greps (the S16 BM25 litmus)" },
        ops_appetite: { type: "string", enum: ["low", "high"], description: "ops appetite (default low)" },
      },
      required: ["corpus_size"],
    },
    handler: (args) => {
      const input: EngineSelectInput = {
        corpusSize: num(args, "corpus_size"),
        multitenant: optBool(args, "multitenant", false),
        latencyCritical: optBool(args, "latency_critical", false),
        onPostgres: optBool(args, "on_postgres", false),
        offline: optBool(args, "offline", false),
        opsAppetite: optStr(args, "ops_appetite", "low") === "high" ? "high" : "low",
      };
      return selectEngine(input);
    },
  },
  {
    name: "truffle_hybrid_design",
    description:
      "Emit the copy-paste hybrid (BM25+vector) query template for an engine + the fusion note (Meili semanticRatio / Typesense auto-fuse / ES rrf retriever / Postgres two-CTE RRF SQL). Pure code (JTBD-2.7, O5).",
    inputSchema: {
      type: "object",
      properties: { engine: { type: "string", enum: ["meili", "typesense", "es", "postgres"] } },
      required: ["engine"],
    },
    handler: (args) => {
      const engine = str(args, "engine");
      const t = HYBRID_TEMPLATES[engine];
      if (!t) throw new Error(`unknown engine "${engine}" — one of: ${Object.keys(HYBRID_TEMPLATES).join(", ")}`);
      return { engine, query_template: t.template, fusion_note: t.fusionNote };
    },
  },
  {
    name: "truffle_facet_plan",
    description:
      "Faceting-at-scale cost dials for a field of the given cardinality (cardinality reduction, count-cap '500+', terminate_after/size:0, sampling, multi-select exclusion) — faceting is a SYSTEMS problem, not GROUP BY+COUNT. Pure code (O16/O17, S5).",
    inputSchema: {
      type: "object",
      properties: {
        field: { type: "string" },
        cardinality: { type: "number", description: "distinct value count for the field (the primary cost axis)" },
        result_set: { type: "number", description: "matched-set size the facet is computed over (optional)" },
      },
      required: ["field", "cardinality"],
    },
    handler: (args) =>
      planFacet({ field: str(args, "field"), cardinality: num(args, "cardinality"), resultSet: optNum(args, "result_set") }),
  },
  {
    name: "truffle_rerank_advise",
    description:
      "ADD or SKIP a reranker (the biggest single quality lever, BUT skip when MRR@5>0.85 or latency can't absorb +100-500ms). Pure code (O6/S6, P12).",
    inputSchema: {
      type: "object",
      properties: {
        mrr_at_5: { type: "number", description: "current bi-encoder MRR@5 (0-1)" },
        latency_budget_ms: { type: "number", description: "end-to-end latency budget in ms" },
        surface: { type: "string", description: "surface hint: autocomplete|rag|search" },
      },
    },
    handler: (args) => rerankAdvise(args),
  },
  {
    name: "truffle_embed_advise",
    description:
      "Shortlist embedders (boring default first) + flag dims-vs-HNSW-cap (2000 float32 / 4000 halfvec → Matryoshka-truncate) + insist a domain golden-set eval decides. MTEB is a prior, not an oracle. Pure code (O7/O8/O9, S11/S14).",
    inputSchema: {
      type: "object",
      properties: {
        corpus: { type: "string", description: "corpus path (message only — eval is on YOUR golden set, never auto-run)" },
        index_cap: { type: "number", enum: [2000, 4000], description: "pgvector HNSW cap (default 2000)" },
        long_context: { type: "boolean", description: "need a long-context embedder (large chunks)" },
      },
    },
    handler: (args) => {
      const cap = (optNum(args, "index_cap") === 4000 ? 4000 : 2000) as IndexCap;
      return adviseEmbedder({ indexCap: cap, longContext: optBool(args, "long_context", false), corpus: optStr(args, "corpus", "") || undefined });
    },
  },
  {
    name: "truffle_tenant_key",
    description:
      "Emit a SERVER-ENFORCED scoped key / tenant token baking the tenant filter (Typesense HMAC scoped key / Meili tenant token) — NEVER the client filter (bypassable). Pure code (O23/S7).",
    inputSchema: {
      type: "object",
      properties: {
        filter: { type: "string", description: 'tenant predicate, e.g. "tenant_id = 42"' },
        engine: { type: "string", enum: ["typesense", "meili"] },
      },
      required: ["filter", "engine"],
    },
    handler: (args) => tenantKey(args),
  },
  {
    name: "truffle_brain_search",
    description:
      "BM25 search over truffle's expertise brain (brain/*.md) — returns ranked hits with file + excerpt. The in-house-BM25 case truffle keeps on purpose (S16). Pure code.",
    inputSchema: {
      type: "object",
      properties: { query: { type: "string" }, limit: { type: "number", description: "max hits (default 5)" } },
      required: ["query"],
    },
    handler: (args) => ({ hits: runBrainSearch(str(args, "query"), optNum(args, "limit") ?? 5) }),
  },
];

// Re-export the fusion primitives so a future `truffle_hybrid_fuse` tool (not in the §4 11-tool list, but
// available to dispatch) can reuse them without re-importing the core. Keeps fusion one-source-of-truth.
export { rrf, tieredFuse };
export type { RankList, Tier };
