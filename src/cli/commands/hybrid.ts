// hybrid.ts — the `truffle hybrid design|fuse` command group (DETERMINISTIC).
//
//   truffle hybrid design --engine <e>  → emit the copy-paste hybrid query for the engine (per-engine syntax).
//   truffle hybrid fuse --method <m>     → compute the fusion over rank lists (delegates to B3's fusion core, O5).
//
// Source: PLAN §4 CLI tree · brain JTBD-2.6/2.7 · O5 (RRF is the floor).

import type { Command } from "commander";
import { rrf, tieredFuse, type RankList } from "../../core/fusion.js";

/** Per-engine hybrid query templates (the syntax that differs per engine; JTBD-2.7). */
const HYBRID_TEMPLATES: Record<string, { template: string; fusionNote: string }> = {
  meili: {
    template: `POST /indexes/{index}/search\n{ "q": "{query}", "hybrid": { "embedder": "default", "semanticRatio": 0.5 } }`,
    fusionNote: "Meili fuses keyword+vector internally via semanticRatio (hybrid-on-by-default in 2026); tune the ratio on a golden set, don't stop at 0.5 (O5).",
  },
  typesense: {
    template: `GET /collections/{c}/documents/search\n  ?q={query}&query_by=embedding,title,body&vector_query=embedding:([], k:100)`,
    fusionNote: "Typesense auto-fuses when query_by spans a vector field + text fields; the cleanest hybrid API. RRF under the hood — tune query_by weights on a golden set (O5).",
  },
  es: {
    template: `POST /{index}/_search\n{ "retriever": { "rrf": { "retrievers": [ {"standard":{"query":{"match":{"body":"{query}"}}}}, {"knn":{"field":"embedding","query_vector":[...],"k":100}} ], "rank_constant": 60 } } }`,
    fusionNote: "ES rrf retriever fuses a BM25 standard retriever + a knn retriever; rank_constant=60 is the floor — boost on top (O5).",
  },
  postgres: {
    template: `WITH bm25 AS (SELECT id, ts_rank_cd(...) r FROM docs WHERE tsv @@ plainto_tsquery('{query}') ORDER BY r DESC LIMIT 100),\n     vec AS (SELECT id, 1-(embedding <=> '{qvec}') r FROM docs ORDER BY embedding <=> '{qvec}' LIMIT 100)\nSELECT id, COALESCE(1.0/(60+bm25.rrk),0)+COALESCE(1.0/(60+vec.vrk),0) score FROM ... ORDER BY score DESC;`,
    fusionNote: "pgvector has NO built-in fusion — you hand-roll the two-CTE RRF (k=60). Needs pgvector ≥ 0.8 + hnsw.iterative_scan for correct filtered-ANN (P17/S4).",
  },
};

/** Register `hybrid design` + `hybrid fuse`. */
export function registerHybridCommand(program: Command): void {
  const hybrid = program.command("hybrid").description("hybrid (BM25+vector) query design + fusion");

  hybrid
    .command("design")
    .description("emit the copy-paste hybrid query template for an engine")
    .requiredOption("--engine <e>", "meili|typesense|es|postgres")
    .action((opts: { engine: string }) => {
      const t = HYBRID_TEMPLATES[opts.engine];
      if (!t) {
        process.stderr.write(`unknown engine "${opts.engine}" — one of: ${Object.keys(HYBRID_TEMPLATES).join(", ")}\n`);
        process.exitCode = 1;
        return;
      }
      process.stdout.write(`# hybrid query for ${opts.engine}\n${t.template}\n\n# fusion: ${t.fusionNote}\n`);
    });

  hybrid
    .command("fuse")
    .description("compute the fusion over ranked lists (RRF k=60 floor + tiered boost)")
    .option("--method <m>", "rrf|tiered", "rrf")
    .option("--lists <json>", 'ranked lists as JSON, e.g. \'[["a","b"],["b","a"]]\'', "[]")
    .option("--tiers <json>", 'tiers for --method tiered, e.g. \'[{"ids":["a"],"boost":100}]\'', "[]")
    .action((opts: { method: string; lists: string; tiers: string }) => {
      let lists: RankList[];
      try {
        lists = JSON.parse(opts.lists);
        if (!Array.isArray(lists)) throw new Error("not an array");
      } catch {
        process.stderr.write("--lists must be a JSON array of string arrays\n");
        process.exitCode = 1;
        return;
      }
      const fused =
        opts.method === "tiered" ? tieredFuse(lists, JSON.parse(opts.tiers)) : rrf(lists);
      process.stdout.write(JSON.stringify({ method: opts.method, fused }, null, 2) + "\n");
    });
}
