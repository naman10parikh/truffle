#!/usr/bin/env node
// eval/judge/trajectory-judge.mjs — L3: the relevance/engine-decision TRAJECTORY judge (G15, DISPUTE D).
//
// An LLM-as-judge over a search-DECISION trajectory — did truffle (1) ask the corpus-size/control question FIRST,
// (2) name the dense-failure class (codes/SKUs/API-names) when pushed toward pure vector, (3) gate every relevance
// change behind a golden set? CRITICAL STANCE (the override + dsip noSelfGrading): the LLM judge is an INPUT, NEVER
// the gate. A human/behaviour golden set (eval/eval.mjs L1+L2) is the merge gate; this runs on-PR + nightly and is
// NON-BLOCKING. truffle is an LLM and WILL be tempted to LLM-judge its own relevance — this file is structured so
// it CAN'T become the gate: it always exits 0 (advisory), and prints "INPUT-ONLY".
//
// Without ANTHROPIC_API_KEY it runs a DETERMINISTIC shadow rubric (the same 3 trajectory criteria, checked against
// truffle's own brain/skills as the trajectory artifact) so the judge is always runnable + $0 in CI. With the key,
// a real Claude call can score a supplied trajectory (kept minimal; the live call is the additive Wave-V/RSI path).

import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..", "..");

// The 3 trajectory criteria (the brain's spine, O11/O4/O18). The judge scores whether a decision trajectory hit them.
const CRITERIA = [
  { id: "corpus-size-first", needle: /corpus.?size|search platform.{0,20}search box|routing question/i, source: "O11" },
  { id: "dense-failure-class", needle: /lexical|codes?\b|SKU|0x80070005|RTX-4090|error.?code|rare.?entity/i, source: "O4/S1" },
  { id: "gate-behind-golden-set", needle: /golden set|per-query regression|pet.?query|search is never done/i, source: "O18/S12" },
];

/**
 * Deterministic shadow rubric: score truffle's OWN decision artifacts (the engine-select skill + the tune-relevance
 * skill + the brain spine) against the 3 criteria. This is the always-runnable $0 form (the LLM judge is INPUT-only,
 * so a deterministic stand-in is honest — it never claims to BE the human golden set, it's an advisory signal).
 */
function shadowScore() {
  const artifacts = [
    "skills/select-search-engine/SKILL.md",
    "skills/build-hybrid-search/SKILL.md",
    "skills/tune-relevance/SKILL.md",
    "brain/OPINIONS.md",
  ]
    .map((p) => join(ROOT, p))
    .filter((p) => existsSync(p))
    .map((p) => readFileSync(p, "utf8"))
    .join("\n");

  return CRITERIA.map((c) => ({ id: c.id, source: c.source, met: c.needle.test(artifacts) }));
}

function main() {
  const hasKey = Boolean(process.env.ANTHROPIC_API_KEY);
  console.log("L3 trajectory judge (G15) — INPUT-ONLY, NON-BLOCKING (DISPUTE D / dsip noSelfGrading).");
  console.log(`  mode: ${hasKey ? "live-capable (ANTHROPIC_API_KEY present) — running the deterministic shadow rubric this wave; live Claude scoring is the additive RSI/Wave-V path" : "deterministic shadow rubric ($0, no key)"}`);

  const scored = shadowScore();
  for (const s of scored) console.log(`  ${s.met ? "✓" : "·"} ${s.id} (${s.source}): ${s.met ? "present in truffle's decision trajectory" : "not detected"}`);

  const met = scored.filter((s) => s.met).length;
  console.log(`  trajectory signal: ${met}/${scored.length} criteria present.`);
  console.log("  NOTE: this is an INPUT to relevance judgement, never the gate. The merge gate is the human/behaviour golden set in eval/eval.mjs (L1+L2). Exiting 0 (advisory).");
  // ALWAYS exit 0 — the structural guarantee that the LLM judge can never become the merge gate.
  process.exit(0);
}

main();
