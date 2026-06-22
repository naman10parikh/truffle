// advise.ts — the deterministic advisory verbs: facet plan · rerank advise · embed advise · tenant key.
//
//   truffle facet plan <field> --cardinality <n>  → facet-at-scale cost dials (B3 facet-dial; O16/O17). --json.
//   truffle rerank advise --mrr <x> --latency-budget <ms>  → ADD or SKIP a reranker (O6/S6).
//   truffle embed advise --index-cap <2000|4000>  → embedder shortlist + dims-vs-cap (B3 embed-dims; O8/O9/S14).
//   truffle tenant key --filter "<predicate>" --engine <e>  → SERVER-ENFORCED scoped key/token (O23/S7).
//
// Source: PLAN §4 CLI tree.

import type { Command } from "commander";
import { planFacet } from "../../core/facet-dial.js";
import { adviseEmbedder, type IndexCap } from "../../core/embed-dims.js";

/** Register the four advisory verbs. */
export function registerAdviseCommands(program: Command): void {
  // ---- facet plan ----
  const facet = program.command("facet").description("faceting-at-scale planning");
  facet
    .command("plan <field>")
    .description("facet-at-scale plan: cardinality reduction, count-cap, terminate_after, sampling")
    .requiredOption("--cardinality <n>", "distinct value count for the field")
    .option("--result-set <n>", "matched-set size the facet is computed over")
    .option("--json", "emit JSON", false)
    .action((field: string, opts: { cardinality: string; resultSet?: string; json: boolean }) => {
      const plan = planFacet({
        field,
        cardinality: Number(opts.cardinality) || 0,
        resultSet: opts.resultSet !== undefined ? Number(opts.resultSet) : undefined,
      });
      if (opts.json) {
        process.stdout.write(JSON.stringify(plan, null, 2) + "\n");
        return;
      }
      process.stdout.write(
        `${plan.note}\n\ndials:\n${plan.dials.map((d) => `  - ${d.lever}: ${d.value}\n    tradeoff: ${d.tradeoff}`).join("\n")}\n`,
      );
    });

  // ---- rerank advise (ADD or SKIP — O6/S6; deterministic threshold rule) ----
  const rerank = program.command("rerank").description("reranker ADD/SKIP advice");
  rerank
    .command("advise")
    .description("ADD or SKIP a reranker (skip if MRR@5>0.85 or latency can't absorb +100-500ms)")
    .option("--mrr <x>", "current bi-encoder MRR@5 (0-1)")
    .option("--latency-budget <ms>", "end-to-end latency budget in ms")
    .option("--surface <s>", "surface hint: autocomplete|rag|search", "search")
    .option("--json", "emit JSON", false)
    .action((opts: { mrr?: string; latencyBudget?: string; surface: string; json: boolean }) => {
      const mrr = opts.mrr !== undefined ? Number(opts.mrr) : undefined;
      const budget = opts.latencyBudget !== undefined ? Number(opts.latencyBudget) : undefined;
      // O6/S6 rule: skip when retrieval is already near-perfect, OR latency can't absorb a cross-encoder pass.
      let decision: "add" | "skip" = "add";
      let reason: string;
      let model: string | undefined = "cohere-rerank-3.5 (managed) or bge-reranker-v2 on a GPU (zero marginal cost, O10)";
      if (mrr !== undefined && mrr > 0.85) {
        decision = "skip";
        reason = `MRR@5 is already ${mrr} (> 0.85) — reranking a near-perfect set is pure latency cost (O6/S6).`;
        model = undefined;
      } else if (budget !== undefined && budget < 100) {
        decision = "skip";
        reason = `Latency budget ${budget}ms can't absorb a cross-encoder pass (+100-500ms) — wrong on autocomplete (S6).`;
        model = undefined;
      } else {
        reason = `Reranking the top-100 is the biggest single quality lever (+5-15 NDCG@10, +20-35% RAG accuracy) on ${opts.surface} (O6). Vendor benchmarks are marketing — eval on your golden set (P12).`;
      }
      const out = { decision, reason, ...(model ? { model } : {}) };
      if (opts.json) {
        process.stdout.write(JSON.stringify(out, null, 2) + "\n");
        return;
      }
      process.stdout.write(`decision: ${decision}\nreason: ${reason}${model ? `\nmodel: ${model}` : ""}\n`);
    });

  // ---- embed advise ----
  const embed = program.command("embed").description("embedder shortlist + dims-vs-index-cap");
  embed
    .command("advise")
    .description("shortlist embedders via MTEB, flag dims vs HNSW cap, insist on a domain golden-set eval")
    .option("--corpus <path>", "corpus path (message only — eval is on YOUR golden set, never auto-run)")
    .option("--index-cap <n>", "pgvector HNSW cap: 2000 (float32) or 4000 (halfvec)", "2000")
    .option("--long-context", "need a long-context embedder (large chunks)", false)
    .option("--json", "emit JSON", false)
    .action((opts: { corpus?: string; indexCap: string; longContext: boolean; json: boolean }) => {
      const cap = (Number(opts.indexCap) === 4000 ? 4000 : 2000) as IndexCap;
      const advice = adviseEmbedder({ indexCap: cap, longContext: opts.longContext, corpus: opts.corpus });
      if (opts.json) {
        process.stdout.write(JSON.stringify(advice, null, 2) + "\n");
        return;
      }
      process.stdout.write(
        `shortlist (eval on YOUR golden set — MTEB only shortlists, O8):\n` +
          advice.shortlist.map((c) => `  - ${c.model} (${c.dims}d${c.matryoshka ? ", matryoshka" : ""}): ${c.note}`).join("\n") +
          `\n\ndims: ${advice.dimsNote}\ngolden-set required: ${advice.goldenSetRequired}\n`,
      );
    });

  // ---- tenant key (server-enforced; O23/S7) ----
  const tenant = program.command("tenant").description("multi-tenancy scoped-key emission");
  tenant
    .command("key")
    .description("emit a SERVER-ENFORCED scoped key / tenant token baking the tenant filter (never the client filter)")
    .requiredOption("--filter <predicate>", 'tenant predicate, e.g. "tenant_id = 42"')
    .requiredOption("--engine <e>", "typesense|meili")
    .option("--json", "emit JSON", false)
    .action((opts: { filter: string; engine: string; json: boolean }) => {
      if (opts.engine !== "typesense" && opts.engine !== "meili") {
        process.stderr.write(`tenant key supports typesense|meili (got "${opts.engine}")\n`);
        process.exitCode = 1;
        return;
      }
      // The KEY rule (S7): the filter is baked into a server-signed key/token — it CANNOT be bypassed by the client.
      const guidance =
        opts.engine === "typesense"
          ? `Typesense: derive a SCOPED SEARCH KEY via HMAC of a parent search-only key + {"filter_by":"${opts.filter}"}. The filter is embedded in the signed key — the client cannot remove it.`
          : `Meili: mint a TENANT TOKEN signed with an API key, with searchRules {"*":{"filter":"${opts.filter}"}}. The filter rides inside the JWT — the client cannot strip it.`;
      const out = { server_enforced: true, engine: opts.engine, filter: opts.filter, guidance };
      if (opts.json) {
        process.stdout.write(JSON.stringify(out, null, 2) + "\n");
        return;
      }
      process.stdout.write(`server-enforced: true\nengine: ${opts.engine}\nfilter: ${opts.filter}\n${guidance}\n`);
    });
}
