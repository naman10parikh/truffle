// src/runtime/run-log.ts — the in-src structured run-record writer (E3 Observability, §10) the eval runtime uses.
//
// One JSON line per truffle run appended to logs/runs.jsonl (the SAME sink as src/dispatch/route.ts — one log).
// For a SEARCH employee the load-bearing fields are the RELEVANCE VERDICT (recall_at_10 / mrr / hit_rate) + the
// ENGINE + FUSION mode (HARNESS-OVERRIDES §10 override — NOT cost). scripts/log-run.mjs is the standalone mjs
// mirror (E3's named CLI deliverable + what the cockpit/smoke use); this is the TS path eval-suite.ts writes
// through (kept in src/ so tsc's rootDir stays clean). Both write the identical record shape to the identical file.

import { appendFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";

/** The structured run record. The override fields (recall_at_10/mrr/hit_rate + engine + fusion) are load-bearing. */
export interface RunRecord {
  ts?: string;
  kind: string;
  model?: string;
  duration_ms?: number;
  tool?: string;
  tool_calls?: number;
  engine?: string;
  fusion?: string;
  recall_at_10?: number;
  mrr?: number;
  hit_rate?: number;
  regressions?: number;
  suite?: string;
  detail?: string;
}

/** logs/runs.jsonl relative to the repo root (cwd) — identical to route.ts + scripts/log-run.mjs (one sink). */
export function runsLogPath(): string {
  return join(process.cwd(), "logs", "runs.jsonl");
}

/** Append one run record (stamps `ts` if absent), creating logs/ on first write. Returns the written record. */
export function logRun(record: RunRecord, logPath: string = runsLogPath()): RunRecord {
  const rec: RunRecord = { ts: new Date().toISOString(), ...record };
  mkdirSync(dirname(logPath), { recursive: true });
  appendFileSync(logPath, JSON.stringify(rec) + "\n");
  return rec;
}
