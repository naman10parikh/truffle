// scripts/log-run.mjs — append one structured run record to logs/runs.jsonl (E3 / Observability, §10).
//
// The energy-hub log-run.mjs pattern: one JSON line per truffle run. For a SEARCH employee the load-bearing field
// is the RELEVANCE VERDICT (Recall@10 / MRR / hit-rate on the golden set) + the ENGINE + FUSION MODE used — NOT
// cost (HARNESS-OVERRIDES §10 override). That verdict is the signal the "search is never done" RSI loop acts on.
// logs/runs.jsonl is NOT gitignored (committable). Usable as a module (import { logRun }) — eval-suite.ts calls it —
// AND as a CLI: `node scripts/log-run.mjs '<json>'` appends a record.
//
// Pure Node, no deps. Record shape (the override fields are required for an eval run; others optional):
//   { ts, kind, model, duration_ms, tool, tool_calls, engine, fusion, recall_at_10, mrr, hit_rate, regressions, suite, detail }

import { appendFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";

/** Resolve logs/runs.jsonl relative to the repo root (cwd) — the same path src/dispatch/route.ts uses (one sink). */
export function runsLogPath() {
  return join(process.cwd(), "logs", "runs.jsonl");
}

/**
 * Append one run record as a JSON line, stamping `ts` if absent. Creates logs/ on first write. Returns the record.
 * The relevance verdict (recall_at_10 / mrr / hit_rate) + engine + fusion are the load-bearing fields for an eval
 * run (§10 override) — callers that have them MUST pass them so the cockpit + RSI loop have a measured signal.
 */
export function logRun(record, logPath = runsLogPath()) {
  const rec = { ts: new Date().toISOString(), ...record };
  mkdirSync(dirname(logPath), { recursive: true });
  appendFileSync(logPath, JSON.stringify(rec) + "\n");
  return rec;
}

// CLI: `node scripts/log-run.mjs '<json-record>'` — append an ad-hoc record (used by smoke scripts / manual runs).
if (import.meta.url === `file://${process.argv[1]}`) {
  const raw = process.argv[2];
  if (!raw) {
    process.stderr.write("usage: node scripts/log-run.mjs '<json record>'\n");
    process.exit(1);
  }
  let record;
  try {
    record = JSON.parse(raw);
  } catch (e) {
    process.stderr.write(`invalid JSON record: ${e instanceof Error ? e.message : String(e)}\n`);
    process.exit(1);
  }
  const written = logRun(record);
  process.stdout.write(`appended run record to ${runsLogPath()}: ${JSON.stringify(written)}\n`);
}
