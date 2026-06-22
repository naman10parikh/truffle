#!/usr/bin/env node
// scripts/log-aggregate.mjs — the aggregator view over logs/runs.jsonl (E3 / Observability §10).
//
// Reads logs/runs.jsonl and summarises truffle's runs — for a SEARCH employee the headline is the RELEVANCE
// VERDICT TREND (latest Recall@10 / MRR / hit-rate per suite) + engine/fusion + regression counts (the "search is
// never done" signal the RSI loop + the cockpit read). Pure Node, no deps. `--json` for machine consumption.
//
// Usage:  node scripts/log-aggregate.mjs [--json]

import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const logPath = join(process.cwd(), "logs", "runs.jsonl");
const asJson = process.argv.includes("--json");

if (!existsSync(logPath)) {
  process.stdout.write(asJson ? "{}\n" : "no logs/runs.jsonl yet — run `truffle eval` first.\n");
  process.exit(0);
}

const lines = readFileSync(logPath, "utf8").trim().split("\n").filter(Boolean);
const records = [];
for (const l of lines) {
  try {
    records.push(JSON.parse(l));
  } catch {
    /* skip a malformed line — never crash the aggregator on one bad row */
  }
}

// Count by kind (eval / route step / etc.).
const byKind = {};
for (const r of records) {
  const k = r.kind ?? r.step ?? "unknown";
  byKind[k] = (byKind[k] ?? 0) + 1;
}

// Latest eval verdict per suite (the load-bearing relevance trend).
const evals = records.filter((r) => r.kind === "eval");
const latestBySuite = {};
for (const e of evals) {
  const suite = e.suite ?? "golden";
  // records are append-ordered → the last one wins as "latest".
  latestBySuite[suite] = {
    ts: e.ts,
    recall_at_10: e.recall_at_10,
    mrr: e.mrr,
    hit_rate: e.hit_rate,
    engine: e.engine,
    fusion: e.fusion,
    regressions: e.regressions,
  };
}

const summary = { total_records: records.length, by_kind: byKind, latest_eval_by_suite: latestBySuite };

if (asJson) {
  process.stdout.write(JSON.stringify(summary, null, 2) + "\n");
} else {
  process.stdout.write(`truffle run log — ${records.length} records\n`);
  process.stdout.write(`  by kind: ${Object.entries(byKind).map(([k, n]) => `${k}=${n}`).join(", ")}\n`);
  process.stdout.write(`  latest relevance verdict (the "search is never done" signal):\n`);
  for (const [suite, v] of Object.entries(latestBySuite)) {
    process.stdout.write(
      `    [${suite}] Recall@10=${v.recall_at_10} MRR=${v.mrr} hit-rate=${v.hit_rate} ` +
        `engine=${v.engine} fusion=${v.fusion} regressions=${v.regressions} (${v.ts})\n`,
    );
  }
  if (Object.keys(latestBySuite).length === 0) process.stdout.write(`    (no eval runs yet)\n`);
}
