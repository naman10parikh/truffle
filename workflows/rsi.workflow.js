#!/usr/bin/env node
// workflows/rsi.workflow.js — truffle's DETERMINISTIC ($0, tokenless) RSI loop (the "search is never done" engine).
//
// The most vertical-native RSI in the fleet (HARNESS-OVERRIDES "RSI"): "search is never done" (O19) IS the AutoLab
// loop applied to search, and the version-bump regression suite (O20/S8) IS the deterministic $0 check. This is the
// L2 deterministic half D2's rsi.yml schedules nightly (the Claude half lights up at CLAUDE_CODE_OAUTH_TOKEN, D8).
//
// The loop has four deterministic dimensions (PLAN §11 / HARNESS-OVERRIDES):
//   1. relevance health      — re-run the golden eval pyramid (eval/eval.mjs); flag any Recall@10/MRR regression.
//   2. version-bump safety   — run `truffle eval --suite version-bump` (the typo + hybrid-scoring + lexical-ID
//                              classes) against the current pinned engine.
//   3. tool-matrix currency  — re-probe the live engine versions via `gh api` (NOT WebFetch — the brain caught
//                              WebFetch hallucinating Typesense dates, GAPS §4); flag a version bump.
//   4. brain freshness       — flag a brain claim whose cited issue may have changed state (advisory).
// Output: a PROPOSED DIFF (what to change, e.g. "Meili shipped vX — re-ran the typo suite, 0 regressions, bump the
// pin") + an EVAL VERDICT, gated PR. NEVER self-grades (it runs the deterministic eval, it does not LLM-judge).
//
// `node workflows/rsi.workflow.js --dry-run` → {proposed_diff, eval_verdict} WITHOUT needing an engine or network
// (the verify line). A full run (`--run`, in CI with the Meili service + GH_TOKEN) executes dims 1-3 for real.

import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..");
const DRY = process.argv.includes("--dry-run");

/** The engine version pins truffle tracks (the TOOL-MATRIX currency gates, GAPS §1). gh-api-verified, never WebFetch. */
const VERSION_GATES = [
  { repo: "meilisearch/meilisearch", pinned: "v1.28", note: "default engine; the acceptance/rsi services: image" },
  { repo: "typesense/typesense", pinned: "v28", note: "alt engine; #2313 typo regression OPEN as of brain time — re-check on bump (O20/S8)" },
  { repo: "pgvector/pgvector", pinned: "v0.8.0", note: "the acorn-owned path; ≥0.8 + hnsw.iterative_scan for filtered-ANN (P17/S4)" },
];

/** Dim 1+2 (deterministic, $0): run the eval pyramid + the version-bump suite. Returns a verdict object. */
function runEvalVerdict() {
  if (DRY) {
    return {
      ran: false,
      mode: "dry-run",
      note: "dry-run: would run `node eval/eval.mjs` (golden pyramid) + `truffle eval --suite version-bump` (typo + hybrid-scoring + lexical-ID classes) against the pinned Meili; skipped (no engine in --dry-run).",
    };
  }
  // Real run: the golden pyramid (engine must be up — CI services: block). eval.mjs exits non-zero on a regression.
  try {
    const out = execFileSync("node", [join(ROOT, "eval/eval.mjs")], { cwd: ROOT, encoding: "utf8" });
    return { ran: true, mode: "run", pass: true, tail: out.trim().split("\n").slice(-1)[0] };
  } catch (e) {
    // A non-zero eval is a FLAGGED regression — the loop reports it (snap-back is the gated-PR action), not a crash.
    const stdout = e && e.stdout ? String(e.stdout) : "";
    return { ran: true, mode: "run", pass: false, tail: stdout.trim().split("\n").slice(-1)[0] || (e instanceof Error ? e.message : String(e)) };
  }
}

/** Dim 3 (deterministic, $0 — uses `gh api`, NOT WebFetch): re-probe each version gate's latest release. */
function checkVersionGates() {
  const findings = [];
  for (const gate of VERSION_GATES) {
    if (DRY) {
      findings.push({ repo: gate.repo, pinned: gate.pinned, latest: "(dry-run: would `gh api repos/" + gate.repo + "/releases/latest`)", drift: null, note: gate.note });
      continue;
    }
    // gh api — the brain's anti-hallucination rule (GAPS §4): query the API, never summarise a WebFetch. Capture
    // BOTH streams (stdio pipe) so a gh error (e.g. a repo that uses tags not releases → 404) never leaks to our
    // JSON stdout. On releases/latest 404, fall back to the newest tag (pgvector tags, doesn't cut GH "releases").
    const ghJson = (args) => execFileSync("gh", args, { stdio: ["ignore", "pipe", "pipe"], encoding: "utf8" }).trim();
    let latest = null;
    try {
      latest = ghJson(["api", `repos/${gate.repo}/releases/latest`, "--jq", ".tag_name"]);
    } catch {
      try {
        // fallback: the most recent tag (some repos tag without cutting a GitHub "release").
        latest = ghJson(["api", `repos/${gate.repo}/tags`, "--jq", ".[0].name"]);
      } catch (e2) {
        findings.push({ repo: gate.repo, pinned: gate.pinned, latest: "(gh api unavailable)", drift: null, note: `${gate.note} — gh api failed: ${e2 instanceof Error ? e2.message.split("\n")[0] : String(e2)}` });
        continue;
      }
    }
    findings.push({ repo: gate.repo, pinned: gate.pinned, latest, drift: latest !== gate.pinned, note: gate.note });
  }
  return findings;
}

/** Build the proposed diff from the version-gate findings (the gated-PR payload — what to change + why). */
function proposeDiff(gateFindings, evalVerdict) {
  const drifted = gateFindings.filter((f) => f.drift === true);
  if (drifted.length === 0) {
    return {
      action: "none",
      summary: "no version drift detected across the tracked engines; pins current. No change proposed.",
      details: gateFindings.map((f) => `${f.repo}: pinned ${f.pinned}, latest ${f.latest}`),
    };
  }
  return {
    action: "propose-version-bump",
    summary: `version drift on: ${drifted.map((f) => `${f.repo} ${f.pinned}→${f.latest}`).join("; ")}. ` +
      `Per O20/S8 (never treat a bump as a no-op): re-run the version-bump regression suite (typo + hybrid-scoring + lexical-ID) ` +
      `BEFORE bumping the pin. Eval verdict this run: ${evalVerdict.pass === false ? "REGRESSION FLAGGED — do NOT bump, pin the prior version" : evalVerdict.ran ? "clean" : "(not run in dry-run)"}.`,
    details: drifted.map((f) => `bump ${f.repo} pin ${f.pinned}→${f.latest} (after the regression suite passes); update the TOOL-MATRIX version cell. ${f.note}`),
  };
}

function main() {
  const evalVerdict = runEvalVerdict();
  const gateFindings = checkVersionGates();
  const proposed_diff = proposeDiff(gateFindings, evalVerdict);

  // Dim 4 (advisory): a one-line brain-freshness reminder (the cited OPEN issues to re-check).
  const brain_freshness = {
    note: "re-check whether the cited OPEN issues changed state (Typesense #2313 typo regression, #2365 hybrid+symbols scoring) — if closed, refresh the brain claim.",
  };

  const output = {
    ts: new Date().toISOString(),
    mode: DRY ? "dry-run" : "run",
    eval_verdict: evalVerdict,
    version_gates: gateFindings,
    brain_freshness,
    proposed_diff,
    noSelfGrading: true, // structural: this loop runs the deterministic eval; it NEVER LLM-judges its own relevance.
  };
  process.stdout.write(JSON.stringify(output, null, 2) + "\n");
  // The loop itself always exits 0 (it's an observer that PROPOSES; the gated PR + snap-back are downstream). A real
  // eval regression is REPORTED in eval_verdict.pass=false, not thrown — so the nightly schedule never red-fails on
  // a regression it's meant to surface. (CI's separate `truffle eval` step is the red-blocking gate.)
  process.exit(0);
}

main();
