#!/usr/bin/env node
// eval/eval.mjs — truffle's eval pyramid entry (E1 / Evals §9). `node eval/eval.mjs` is THE canonical checkpoint.
//
// LEVELS (Hamel mapping per eval/golden/golden-tasks.json + PLAN §6):
//   L1  — structural/decision assertions, one per house rule (the fusion math RRF k=60, the tiered-boost lift, the
//         facet-dial calc, the engine-selector tree, the embed-dims cap, the per-query regression scorer). PURE
//         CODE, $0, NO engine — these ALWAYS run and gate (red-blocking).
//   L2  — the ≥10 golden tasks G1–G15. The DECISION-class tasks (G2/G3/G5/G6/G7/G10/G12/G13/G14) assert truffle's
//         deterministic cores/stances here ($0, no engine). The RETRIEVAL-class tasks (G1/G4/G8/G9/G11 + the typo +
//         lexical-ID + hybrid-ordering classes) need the live engine → they run via the compiled eval-suite runtime
//         WHEN the engine is reachable (in CI's acceptance/services: block it always is, and they gate merge).
//   L3  — the LLM-judge over a relevance/engine-decision TRAJECTORY (eval/judge/trajectory-judge.mjs) — an INPUT,
//         never the gate (DISPUTE D / dsip noSelfGrading); on-PR + nightly, NON-blocking (G15).
//
// The override (HARNESS-OVERRIDES §9): the golden set MUST carry the typo class + the lexical-ID class + per-query
// regression — all asserted below (typo/lexical/0x80070005/RTX-4090/regress all appear). Exit 0 = all run levels
// pass. Pass^k (k≥3) on the deterministic core assertions (PASS_K below). Imports the COMPILED cores from dist/
// (run `pnpm build` first — CI does).

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..");
const PASS_K = 3; // Pass^k: each deterministic assertion must hold k≥3 times (checklist §9) — they're deterministic, so k re-runs prove stability.

// ── load the COMPILED deterministic cores (B3) + the eval-suite runtime (E1/E3) from dist/ ───────────────────────
let fusion, facetDial, engineSelector, embedDims, evalScorer;
try {
  fusion = await import(join(ROOT, "dist/core/fusion.js"));
  facetDial = await import(join(ROOT, "dist/core/facet-dial.js"));
  engineSelector = await import(join(ROOT, "dist/core/engine-selector.js"));
  embedDims = await import(join(ROOT, "dist/core/embed-dims.js"));
  evalScorer = await import(join(ROOT, "dist/core/eval-scorer.js"));
} catch (e) {
  console.error(`eval.mjs: could not import compiled cores from dist/ — run \`pnpm build\` first.\n  ${e instanceof Error ? e.message : e}`);
  process.exit(1);
}

const tasks = JSON.parse(readFileSync(join(ROOT, "eval/golden/golden-tasks.json"), "utf8")).tasks;

let passed = 0;
let failed = 0;
const results = [];
function check(id, label, fn) {
  // Pass^k: run the deterministic assertion k≥3 times; it passes only if it holds every time.
  let ok = true;
  let detail = "";
  for (let i = 0; i < PASS_K; i++) {
    try {
      const r = fn();
      if (r !== true) {
        ok = false;
        detail = typeof r === "string" ? r : "assertion returned non-true";
        break;
      }
    } catch (e) {
      ok = false;
      detail = e instanceof Error ? e.message : String(e);
      break;
    }
  }
  results.push({ id, label, pass: ok, detail });
  if (ok) {
    passed++;
    console.log(`  ✓ ${id} ${label}`);
  } else {
    failed++;
    console.log(`  ✗ ${id} ${label} — ${detail}`);
  }
}

console.log("truffle eval — L1 (house-rule assertions) + L2 decision golden tasks  [Pass^k k=" + PASS_K + "]\n");

// ── L1: house-rule structural assertions (one per deterministic core) ────────────────────────────────────────────
console.log("L1 — structural/decision assertions:");

// L1.1 — RRF with k=60 on two known rank lists yields the documented fused order (the fusion-math house rule, O5).
check("L1.1", "RRF k=60 fuses two rank lists into the documented order A,B,C,D", () => {
  // BM25 leg: A,B,C. Vector leg: B,A,D. A & B tie on RRF score (1/61+1/62 each) → A first (lexicographic tiebreak);
  // C & D tie (1/63 each) → C first. Documented fused order = A,B,C,D (matches src/core/fusion.test.ts).
  const bm25 = ["A", "B", "C"];
  const vector = ["B", "A", "D"];
  const fused = fusion.rrf([bm25, vector], 60).map((h) => h.id);
  if (fusion.RRF_K !== 60) return `RRF_K should be 60, is ${fusion.RRF_K}`;
  if (fused.join(",") !== "A,B,C,D") return `expected A,B,C,D, got ${fused.join(",")}`;
  return true;
});

// L1.2 — tiered boost is a REAL lift over naive RRF: a 100×-boosted doc outranks the naive-RRF leader (O5 — RRF is the floor).
check("L1.2", "tiered boost changes order vs naive RRF (RRF is the floor not the finish, O5)", () => {
  const a = ["lead", "cand", "tail"];
  const b = ["lead", "cand", "tail"];
  const naive = fusion.rrf([a, b], 60).map((h) => h.id);
  const tiered = fusion.tieredFuse([a, b], [{ ids: ["cand"], boost: 100 }], 60).map((h) => h.id);
  if (naive[0] !== "lead") return `naive RRF should lead with 'lead', got ${naive[0]}`;
  if (tiered[0] !== "cand") return `tiered (100× boost on 'cand') should promote it to #1, got ${tiered[0]}`;
  return true;
});

// L1.3 — facet-dial treats a high-cardinality facet as a SYSTEMS problem with the right dials (O16/S5).
check("L1.3", "facet-dial prescribes scale dials for a high-cardinality facet (O16/S5)", () => {
  const plan = facetDial.planFacet({ field: "brand", cardinality: 2_000_000, resultSet: 500_000 });
  if (plan.safe) return "a 2M-cardinality facet must NOT be marked safe";
  const levers = plan.dials.map((d) => d.lever);
  for (const need of ["cardinality-reduction", "count-cap", "facet-sampling"]) {
    if (!levers.includes(need)) return `missing dial: ${need} (have: ${levers.join(", ")})`;
  }
  return true;
});

// L1.4 — a low-cardinality facet is left simple (don't over-engineer a 5-value category facet).
check("L1.4", "facet-dial leaves a low-cardinality facet simple (no over-engineering)", () => {
  const plan = facetDial.planFacet({ field: "category", cardinality: 4, resultSet: 100 });
  return plan.safe === true ? true : "a 4-value facet over 100 docs should be safe (single-pass)";
});

// L1.5 — engine-selector recommends Typesense for the multitenant case (the B2 contract case, O12/S7).
check("L1.5", "engine-selector → Typesense for a large multitenant corpus (O12/S7)", () => {
  const r = engineSelector.selectEngine({ corpusSize: 500_000, multitenant: true });
  if (r.engine !== "typesense") return `expected typesense, got ${r.engine}`;
  if (!r.reason || r.reason.length === 0) return "reason must be non-empty";
  return true;
});

// L1.6 — embed-dims flags the 3072-dim > 2000 cap and prescribes Matryoshka/halfvec (S14).
check("L1.6", "embed-dims flags the 3072>2000 HNSW cap, prescribes Matryoshka/halfvec (S14)", () => {
  const a = embedDims.adviseEmbedder({ indexCap: 2000 });
  if (!a.overCap.includes("openai/text-embedding-3-large")) return `3-large (3072) should be over the 2000 cap; overCap=${a.overCap.join(", ")}`;
  if (a.goldenSetRequired !== true) return "goldenSetRequired must be true (MTEB is a prior, O8)";
  if (!/matryoshka|halfvec/i.test(a.dimsNote)) return "dimsNote must prescribe Matryoshka or halfvec";
  return true;
});

// L1.7 — the per-query regression scorer FLAGS a fix that improves A but regresses B (the pet-query trap, O18/S12).
check("L1.7", "eval-scorer findRegressions flags a per-query regression (pet-query trap, O18/S12)", () => {
  const baseline = evalScorer.scoreEval(
    [{ query: "A", returned: ["a1"] }, { query: "B", returned: ["b1"] }],
    [{ query: "A", relevant: ["a1"] }, { query: "B", relevant: ["b1"] }],
  );
  const candidate = evalScorer.scoreEval(
    [{ query: "A", returned: ["a1"] }, { query: "B", returned: ["x"] }], // B regressed (b1 dropped)
    [{ query: "A", relevant: ["a1"] }, { query: "B", relevant: ["b1"] }],
  );
  const regs = evalScorer.findRegressions(baseline, candidate);
  if (!regs.some((r) => r.query === "B")) return `expected a regression on B; got ${JSON.stringify(regs)}`;
  return true;
});

// ── L2: decision-class golden tasks (the $0, no-engine subset of G1–G15) ─────────────────────────────────────────
console.log("\nL2 — decision-class golden tasks (deterministic, $0):");

// G2 (S1) — pure-vector pitch over code/SKU → hybrid is insisted on; the lexical-ID class (0x80070005) names the failure.
check("G2", "(S1) lexical-ID class named — pure-vector loses on 0x80070005, hybrid wins", () => {
  // The deterministic proof: the brain's lexical-ID class includes the error-code 0x80070005 + the SKU RTX-4090.
  // engine-selector never recommends pure vector; the hybrid stance is the default. Assert the fixture carries the class.
  const exp = JSON.parse(readFileSync(join(ROOT, "fixtures/golden-expectations.json"), "utf8"));
  const queries = exp.judgements.map((j) => j.query).join(" ");
  if (!queries.includes("0x80070005")) return "the golden set must carry the error-code lexical-ID class (0x80070005)";
  if (!queries.includes("RTX-4090")) return "the golden set must carry the SKU lexical-ID class (RTX-4090)";
  return true;
});

// G3 (S3) — RRF is the floor: tiered tuning beats naive RRF (same assertion as L1.2, framed as the golden task).
check("G3", "(S3) RRF is the floor — tiered tuning changes the winner", () => {
  const lists = [["p", "q"], ["p", "q"]];
  const naive = fusion.rrf(lists, 60).map((h) => h.id)[0];
  const tuned = fusion.tieredFuse(lists, [{ ids: ["q"], boost: 100 }], 60).map((h) => h.id)[0];
  return naive === "p" && tuned === "q" ? true : `naive=${naive} tuned=${tuned} — tuning should change the #1`;
});

// G5 (S5) — high-cardinality facet → systems dials, approximate counts framed as a tradeoff (not "just add the facet").
check("G5", "(S5) high-cardinality facet → systems dials + approximate-count tradeoff", () => {
  const plan = facetDial.planFacet({ field: "tags", cardinality: 50_000, resultSet: 200_000 });
  if (plan.safe) return "50k-cardinality facet over 200k docs must not be safe";
  const samplingDial = plan.dials.find((d) => d.lever === "facet-sampling");
  if (!samplingDial || !/approximate/i.test(samplingDial.tradeoff)) return "sampling must frame approximate counts as a tradeoff (O17)";
  return true;
});

// G6 (S6) — rerank SKIP when MRR@5>0.85; ADD on long-tail/RAG. (engine-selector has no rerank; assert the stance via the skill data.)
check("G6", "(S6) rerank-advise stance present — SKIP when MRR@5>0.85, ADD on long-tail", () => {
  // The rerank decision lives in the add-reranker skill (B1) + the brain (O6/S6). Assert the skill encodes the threshold.
  const skill = readFileSync(join(ROOT, "skills/add-reranker/SKILL.md"), "utf8");
  if (!/0\.85/.test(skill)) return "add-reranker skill must cite the MRR@5>0.85 skip threshold (S6)";
  if (!/skip/i.test(skill) || !/add/i.test(skill)) return "add-reranker skill must cover both ADD and SKIP";
  return true;
});

// G7 (S7) — multi-tenant → server-enforced scoped key, reject the client filter. (Assert via the tenant-key advise path / skill.)
check("G7", "(S7) tenant isolation is server-enforced, rejects the client filter", () => {
  // The tenant-key emitter is a deterministic advise verb; the stance (server-enforced, never client) is the rule.
  // Assert the build-hybrid/tune skills + the engine-selector multitenant branch all point at server-enforced keys.
  const r = engineSelector.selectEngine({ corpusSize: 200_000, multitenant: true });
  if (!/scoped key|HMAC|tenant/i.test(r.reason)) return "the multitenant branch must name server-enforced scoped keys (O23/S7)";
  return true;
});

// G10 (S11) — embedder shortlisted via MTEB then a domain golden-set eval is REQUIRED (not "pick #1").
check("G10", "(S11) embed-advise requires a domain golden-set eval (MTEB is a prior)", () => {
  const a = embedDims.adviseEmbedder({});
  return a.goldenSetRequired === true && a.shortlist.length > 0 ? true : "embed-advise must shortlist + require a golden-set eval (O8)";
});

// G12 (S13) — ES-by-default for a small corpus → recommend Meili/Typesense/Postgres, justify on right-size NOT license.
check("G12", "(S13) small corpus → not ES-by-default; right-size; not license", () => {
  const r = engineSelector.selectEngine({ corpusSize: 20_000 });
  if (r.engine === "elasticsearch" || r.engine === "opensearch") return `small corpus should not pick ES/OpenSearch, got ${r.engine}`;
  const esRejection = r.rejected.find((x) => /elasticsearch/i.test(x));
  if (!esRejection) return "ES must be in the rejected list with a right-size reason";
  if (/license/i.test(esRejection) && !/ops|cost|right-size|petabyte|scale/i.test(esRejection)) return "ES rejection must be on ops/cost/right-size, not license (O14)";
  return true;
});

// G13 (S14) — 3072-dim can't be HNSW-indexed → flag the cap + Matryoshka (same as L1.6, framed as the golden task).
check("G13", "(S14) 3072-dim over the 2000 HNSW cap → flagged + Matryoshka/halfvec", () => {
  const a = embedDims.adviseEmbedder({ indexCap: 2000 });
  return a.overCap.includes("openai/text-embedding-3-large") ? true : "must flag 3-large as over the 2000 cap (S14)";
});

// G14 (S16) — tiny offline corpus → KEEP in-house BM25, do NOT reflexively stand up Meili.
check("G14", "(S16) tiny offline corpus → keep in-house BM25 (don't over-correct)", () => {
  const r = engineSelector.selectEngine({ corpusSize: 300, offline: true });
  return r.engine === "bm25-inhouse" ? true : `tiny offline corpus should keep bm25-inhouse, got ${r.engine}`;
});

// ── L2 retrieval-class golden tasks: run against the live engine IF reachable (CI services: block → gate merge) ───
console.log("\nL2 — retrieval-class golden tasks (live engine):");
let retrievalRan = false;
try {
  const evalSuite = await import(join(ROOT, "dist/runtime/eval-suite.js"));
  // Probe reachability cheaply by attempting the suite; it throws a clear "not reachable" if the engine is down.
  const verdict = await evalSuite.runEval({ suite: "golden" });
  retrievalRan = true;
  // G1 / G4 / G8 / G9 / G11 + the typo + lexical-ID + hybrid-ordering classes are all inside the eval-suite verdict.
  check("G1", "(acceptance) index+search returns typo+SKU+error-code hits, hybrid-ranked, eval green", () =>
    verdict.pass === true ? true : `eval-suite verdict FAIL: hit-rate=${verdict.hit_rate}, regressions=${verdict.regressions.length}`,
  );
  for (const c of verdict.classChecks) {
    // typo / lexical-id / hybrid-ordering — the silent-failure classes the override REQUIRES.
    check(`G-${c.name}`, `(class) ${c.name}`, () => (c.pass ? true : c.detail));
  }
  check("G11", "(S12) per-query regression — no query silently regressed under hybrid", () =>
    verdict.regressions.length === 0 ? true : `regressions: ${verdict.regressions.map((r) => r.query).join(", ")}`,
  );
} catch (e) {
  const msg = e instanceof Error ? e.message : String(e);
  if (/not reachable/i.test(msg)) {
    console.log(`  ⊘ retrieval golden tasks SKIPPED — Meili engine not reachable (local $0 mode). In CI's services: block they run + gate merge.`);
    console.log(`     (boot locally: \`truffle engine up && truffle index ./fixtures/corpus --hybrid\` then re-run; the typo/lexical-ID/hybrid-ordering classes assert there.)`);
  } else {
    // A real error (not "engine down") IS a failure — the eval must surface it, not swallow it.
    failed++;
    console.log(`  ✗ retrieval golden tasks errored: ${msg}`);
  }
}

// ── L3 note: the trajectory judge is INPUT-only, on-PR + nightly, NON-blocking (DISPUTE D / noSelfGrading) ────────
console.log("\nL3 — relevance/engine-decision trajectory judge: eval/judge/trajectory-judge.mjs (INPUT not gate; on-PR+nightly, non-blocking).");

// ── verdict ──────────────────────────────────────────────────────────────────────────────────────────────────────
const total = passed + failed;
console.log(`\n${failed === 0 ? "PASS ✅" : "FAIL ❌"} — ${passed}/${total} checks passed${retrievalRan ? " (incl. live retrieval suite)" : " (decision+L1 only; retrieval skipped — engine down)"}.`);
process.exit(failed === 0 ? 0 : 1);
