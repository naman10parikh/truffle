// src/runtime/eval-suite.ts — `truffle eval` (CLI) + `truffle_eval` (MCP): the relevance proof against the engine.
//
// Runs the RETRIEVAL golden suite against the live engine + the indexed fixture corpus, scores it with the B3
// eval-scorer (Recall@10 / MRR / hit-rate — pure code, NOT an LLM judge; DISPUTE D / dsip noSelfGrading), runs the
// silent-failure classes the override requires (typo + lexical-ID + hybrid-ordering + per-query regression), and
// WRITES the relevance verdict to logs/runs.jsonl (E3 — the load-bearing observability field, §10). `--suite
// golden` = the full pyramid; `--suite version-bump` = the typo + hybrid-scoring regression suite (O20/S8 — the
// never-treat-a-bump-as-a-no-op check). Throws if the engine is down (no fabricated green — Wave V re-runs this).
//
// This is the runtime eval.mjs (E1) calls for the retrieval class, and the route's eval step lands on. The DECISION
// golden tasks (G2/G3/G5/G6/G7/G10/G12/G13/G14) are pure-core assertions and live in eval/eval.mjs ($0, no engine).

import { MeiliClient, meiliConfigFromEnv } from "./meili-client.js";
import { loadGoldenExpectations, loadFixtureQueryVectors } from "./corpus.js";
import { FIXTURE_INDEX } from "./index-corpus.js";
import { scoreEval, findRegressions, type QueryResult, type GoldenJudgement, type EvalReport } from "../core/eval-scorer.js";
import { logRun } from "./run-log.js";
import { readFileSync } from "node:fs";
import { join } from "node:path";

export interface EvalOptions {
  suite?: string;
  json?: boolean;
}

export interface EvalResult {
  suite: string;
  recall_at_10: number;
  mrr: number;
  hit_rate: number;
  engine: string;
  fusion: string;
  /** Per-query regressions vs the BM25-alone baseline (the pet-query trap check, O18/S12). Empty = no regression. */
  regressions: Array<{ query: string; delta: number }>;
  /** The silent-failure-class checks (typo / lexical-ID / hybrid-ordering) — each binary pass/fail with detail. */
  classChecks: Array<{ name: string; pass: boolean; detail: string }>;
  pass: boolean;
}

/** Run a query against the live engine and return its ranked doc ids (rank 1 first). Hybrid when a fixture vector exists. */
async function runQuery(client: MeiliClient, query: string, hybrid: boolean): Promise<string[]> {
  const vec = hybrid ? loadFixtureQueryVectors()[query] : undefined;
  const resp = await client.search(FIXTURE_INDEX, {
    q: query,
    vector: hybrid && vec ? vec : undefined,
    semanticRatio: 0.5,
    limit: 10,
  });
  return resp.hits.map((h) => h.id);
}

/** Load the typo-class set (O20/S8) for the version-bump suite. */
function loadTypoSet(): Array<{ typo: string; form: string; expectId: string }> {
  const path = join(process.cwd(), "eval", "golden", "typo-set.json");
  const parsed = JSON.parse(readFileSync(path, "utf8")) as { cases?: Array<{ typo: string; form: string; expectId: string }> };
  return parsed.cases ?? [];
}

/** Core: run the suite, score it, return the structured result. Throws on engine failure. */
async function evalCore(opts: EvalOptions): Promise<EvalResult> {
  const suite = opts.suite ?? "golden";
  const client = new MeiliClient(meiliConfigFromEnv());
  if (!(await client.health())) {
    throw new Error(
      `Meili is not reachable for eval. Boot it (\`truffle engine up\`) + index (\`truffle index ./fixtures/corpus --hybrid\`) first. ` +
        `MEILI_URL=${process.env.MEILI_URL ?? "http://localhost:7700"}.`,
    );
  }

  const expectations = loadGoldenExpectations();
  const golden: GoldenJudgement[] = expectations.judgements.map((j) => ({ query: j.query, relevant: j.relevant }));

  // Run every golden query under HYBRID (the production mode) → score Recall@10 / MRR / hit-rate.
  const hybridResults: QueryResult[] = [];
  for (const j of golden) hybridResults.push({ query: j.query, returned: await runQuery(client, j.query, true) });
  const hybridReport = scoreEval(hybridResults, golden);

  // BM25-alone baseline (for the per-query regression check + the hybrid-ordering proof).
  const bm25Results: QueryResult[] = [];
  for (const j of golden) bm25Results.push({ query: j.query, returned: await runQuery(client, j.query, false) });
  const bm25Report = scoreEval(bm25Results, golden);

  // Per-query regression (O18/S12): does hybrid silently regress any query vs BM25-alone? (pet-query trap guard)
  const regressions = findRegressions(bm25Report, hybridReport);

  const classChecks = await runClassChecks(client, expectations, suite);

  // The version-bump suite focuses on the typo + hybrid-scoring classes (O20/S8); golden runs the full set.
  const checks = suite === "version-bump" ? classChecks.filter((c) => c.name.startsWith("typo") || c.name.startsWith("hybrid")) : classChecks;
  const allClassPass = checks.every((c) => c.pass);
  // Gate: every golden query found ≥1 relevant doc (hit-rate 1.0), the class checks pass, and no regression.
  const pass = hybridReport.hitRate >= 0.999 && allClassPass && regressions.length === 0;

  const result: EvalResult = {
    suite,
    recall_at_10: round(hybridReport.recallAt10),
    mrr: round(hybridReport.mrr),
    hit_rate: round(hybridReport.hitRate),
    engine: "meilisearch",
    fusion: "hybrid",
    regressions,
    classChecks: checks,
    pass,
  };

  // E3 — write the relevance verdict to logs/runs.jsonl (the load-bearing observability field, §10).
  logRun({
    kind: "eval",
    suite,
    engine: result.engine,
    fusion: result.fusion,
    recall_at_10: result.recall_at_10,
    mrr: result.mrr,
    hit_rate: result.hit_rate,
    regressions: result.regressions.length,
    detail: `eval --suite ${suite}: ${pass ? "PASS" : "FAIL"} (${checks.filter((c) => c.pass).length}/${checks.length} class checks, ${regressions.length} regressions)`,
  });

  return result;
}

/** The silent-failure-class checks the override requires: typo, lexical-ID, hybrid-ordering (O4/O20/S1/S8). */
async function runClassChecks(
  client: MeiliClient,
  expectations: ReturnType<typeof loadGoldenExpectations>,
  suite: string,
): Promise<EvalResult["classChecks"]> {
  const checks: EvalResult["classChecks"] = [];

  // typo class (O20/S8): every typo'd query must still return its expected doc via the engine's typo tolerance.
  for (const tc of loadTypoSet()) {
    const ids = await runQuery(client, tc.typo, false);
    const pass = ids.slice(0, 5).includes(tc.expectId);
    checks.push({
      name: `typo:${tc.form}:${tc.typo}`,
      pass,
      detail: pass
        ? `"${tc.typo}" → ${tc.expectId} in top-5 (typo tolerance OK)`
        : `"${tc.typo}" did NOT return ${tc.expectId} — a typo regression; attribute to the engine version (re-run after the bump), not the config (O20/S8). Got: [${ids.slice(0, 5).join(", ")}]`,
    });
  }

  // lexical-ID class (O4/S1): RTX-4090 must rank above RTX-4070 (dense clusters near-identical SKUs; BM25 separates).
  const lex = expectations.lexicalIdRanking;
  const lexIds = await runQuery(client, lex.query, true);
  const aboveIdx = lexIds.indexOf(lex.above);
  const belowIdx = lexIds.indexOf(lex.below);
  const lexPass = aboveIdx !== -1 && (belowIdx === -1 || aboveIdx < belowIdx);
  checks.push({
    name: `lexical-id:${lex.query}`,
    pass: lexPass,
    detail: lexPass
      ? `${lex.above} ranks above ${lex.below} for "${lex.query}" (lexical-ID exact, O4/S1)`
      : `${lex.above} did NOT rank above ${lex.below} — the SKU/lexical-ID class failed. Order: [${lexIds.join(", ")}]`,
  });

  // hybrid-ordering proof (O3/S1): for the paraphrase query, hybrid's top != BM25-alone's top (fusion changes order).
  const proof = expectations.hybridOrderingProof;
  const bm25Top = (await runQuery(client, proof.query, false))[0];
  const hybridTop = (await runQuery(client, proof.query, true))[0];
  const hybridProofPass = hybridTop === proof.hybridTopId && bm25Top === proof.bm25AloneTopId;
  checks.push({
    name: `hybrid-ordering:${proof.query}`,
    pass: hybridProofPass,
    detail: hybridProofPass
      ? `BM25-alone top=${bm25Top} (${proof.bm25AloneTopId}), hybrid top=${hybridTop} (${proof.hybridTopId}) — fusion changed the order (hybrid != BM25, O3/S1)`
      : `expected BM25 top=${proof.bm25AloneTopId} & hybrid top=${proof.hybridTopId}; got BM25 top=${bm25Top}, hybrid top=${hybridTop}`,
  });

  void suite;
  return checks;
}

function round(n: number): number {
  return Math.round(n * 1e4) / 1e4;
}

/** CLI/MCP entry: run + return the structured verdict (MCP). Prints + sets non-zero exit on FAIL when from the CLI. */
export async function runEval(opts: EvalOptions): Promise<EvalResult> {
  const result = await evalCore(opts);
  if (typeof opts.json === "boolean") {
    if (opts.json) process.stdout.write(JSON.stringify(result, null, 2) + "\n");
    else {
      process.stdout.write(
        `truffle eval --suite ${result.suite}: ${result.pass ? "PASS ✅" : "FAIL ❌"}\n` +
          `  Recall@10=${result.recall_at_10}  MRR=${result.mrr}  hit-rate=${result.hit_rate}  [engine=${result.engine}, fusion=${result.fusion}]\n` +
          `  regressions: ${result.regressions.length === 0 ? "none" : result.regressions.map((r) => `${r.query} (${r.delta.toFixed(3)})`).join(", ")}\n`,
      );
      for (const c of result.classChecks) process.stdout.write(`  ${c.pass ? "✓" : "✗"} ${c.name}: ${c.detail}\n`);
    }
    if (!result.pass) process.exitCode = 1;
  }
  return result;
}
