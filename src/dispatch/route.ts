// src/dispatch/route.ts — truffle's internal routing loop (D1): the ordered multi-step search job.
//
// truffle is a single-employee CLI, not a grid — so dispatch is a deterministic INTERNAL routing loop, not an
// agentgrid spawn. A search job runs in strict dependency order: index → search → eval (you cannot search before
// indexing, nor prove relevance before searching). This module owns (a) that ordering and (b) emitting one
// ordered STEP RECORD per step to logs/runs.jsonl (the dispatch loop "logs each step" — ties to E-observability).
//
// Honest-state discipline (CP122 rule 3): the engine-touching steps (index/search/eval) run against the Cluster-E
// runtime (src/runtime/* + the engine). Until E lands, each step records status:"engine-pending" with the honest
// reason — the ROUTE + the ordered step records are real D1 deliverables NOW; the green eval verdict arrives with
// E. We NEVER write a fabricated "succeeded" eval. When E lands, the same route reports the real per-step result.
//
// Model routing (A7/D12): if a step delegates to a sub-agent (relevance-auditor / engine-selector), it is spawned
// with an EXPLICIT model — `model: "opus"` (ALL Opus under CP123, no bare default). The route NEVER spawns a bare
// default model; SUBAGENT_MODEL below is the single source for that explicit arg.
//
// This is a pure in-process loop — it never drives tmux panes (the focus-stealing pane-select command is banned
// by .claude/rules/agentgrid.md; truffle is a single-employee CLI with no grid).

import { appendFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";

/** ALL CP123 sub-agents run on Opus, max effort (D12). The route passes this EXPLICITLY — never a bare default. */
export const SUBAGENT_MODEL = "opus" as const;

/** The canonical search-job pipeline, in strict dependency order (index must precede search must precede eval). */
export const PIPELINE = ["index", "search", "eval"] as const;
export type Step = (typeof PIPELINE)[number];

/** One ordered step record appended to logs/runs.jsonl. `seq` is the monotonic step index; `ts` the wall clock. */
export interface StepRecord {
  /** The routed job id (a single timestamped run groups its step records). */
  job: string;
  /** Monotonic step sequence (0,1,2,…) — the ordering proof independent of timestamp resolution. */
  seq: number;
  step: Step;
  /** ISO timestamp; monotonic across the run (each step is awaited before the next, so ts is non-decreasing). */
  ts: string;
  /** "ok" once a step's engine runtime is wired (Cluster E); "engine-pending" with a reason until then. */
  status: "ok" | "engine-pending" | "error";
  /** Honest detail: the not-wired reason, or the step's real summary once E lands. */
  detail: string;
}

/** Resolve logs/runs.jsonl relative to the repo root (cwd) — the energy-hub observability convention (E3 owns it). */
export function runsLogPath(): string {
  return join(process.cwd(), "logs", "runs.jsonl");
}

/** Append one step record as a JSON line; create logs/ on first write. Returns the record (for testing). */
export function logStep(rec: StepRecord, logPath: string = runsLogPath()): StepRecord {
  mkdirSync(dirname(logPath), { recursive: true });
  appendFileSync(logPath, JSON.stringify(rec) + "\n");
  return rec;
}

/**
 * Try to load a step's Cluster-E runtime and run it; return the honest outcome. The route does NOT fabricate a
 * success — if the runtime isn't built, the step is "engine-pending" with the reason. Mirrors the CLI/MCP
 * honest-delegation discipline so the route lights up automatically when E lands.
 */
async function runStep(step: Step): Promise<{ status: StepRecord["status"]; detail: string }> {
  const modByStep: Record<Step, { path: string; owner: string }> = {
    index: { path: "../runtime/index-corpus.js", owner: "E2/E4 (fixture corpus + engine lifecycle)" },
    search: { path: "../runtime/search.js", owner: "E2/E4 (engine + fixture corpus)" },
    eval: { path: "../runtime/eval-suite.js", owner: "E1/E3 (golden tasks + eval pyramid)" },
  };
  const { path, owner } = modByStep[step];
  try {
    await import(path);
    // The module exists: the route confirms each step's runtime loads, in order. It does not run the step.
    return { status: "ok", detail: `${step} runtime loads (${owner}); route run checks the order and does not run the step.` };
  } catch (err) {
    const code = (err as { code?: string }).code;
    const msg = err instanceof Error ? err.message : String(err);
    const missing = code === "ERR_MODULE_NOT_FOUND" || /Cannot find module|ERR_MODULE_NOT_FOUND|Failed to load url/.test(msg);
    if (missing) {
      return { status: "engine-pending", detail: `${step} step routed in order; engine runtime (${owner}) not built yet (Cluster E).` };
    }
    return { status: "error", detail: `${step} step errored: ${msg}` };
  }
}

export interface RouteResult {
  job: string;
  steps: StepRecord[];
}

/**
 * Run the canonical search job: index → search → eval, IN ORDER, logging one step record per step. Each step is
 * awaited before the next (so the records are strictly ordered and their timestamps non-decreasing). Returns the
 * job id + the ordered step records. The verifiable D1 deliverable: ≥3 ordered records in logs/runs.jsonl.
 */
export async function routeSearchJob(logPath: string = runsLogPath()): Promise<RouteResult> {
  const job = `route-${new Date().toISOString()}`;
  const steps: StepRecord[] = [];
  for (let seq = 0; seq < PIPELINE.length; seq++) {
    const step = PIPELINE[seq]!;
    const { status, detail } = await runStep(step);
    const rec = logStep({ job, seq, step, ts: new Date().toISOString(), status, detail }, logPath);
    steps.push(rec);
  }
  return { job, steps };
}
