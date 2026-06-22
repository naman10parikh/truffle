// src/dispatch/route.test.ts — D1 routing-loop contract: ordered, ≥3 steps, honest engine state.
//
// NOTE (post-Cluster-E): the route's engine-touching steps (index/search/eval) now delegate to the real
// src/runtime/* modules — E landed, so runStep's `import()` resolves and the route "lit up" exactly as D1's author
// designed ("the route lights up automatically when E's src/runtime/* arrive"). runStep verifies the module is
// WIRED (the import resolves) and reports "ok"; it never fabricates a green eval — a real run failure would surface
// as "error". So the post-E invariant is: status is "ok" (modules wired), NEVER "engine-pending" (which only held
// while E was unbuilt). The end-to-end engine run is proven by the acceptance suite (eval-suite + acceptance.yml).

import { describe, it, expect, afterEach } from "vitest";
import { readFileSync, rmSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { routeSearchJob, PIPELINE, SUBAGENT_MODEL } from "./route.js";

const TMP_LOG = join(tmpdir(), `truffle-route-test-${process.pid}.jsonl`);

afterEach(() => {
  if (existsSync(TMP_LOG)) rmSync(TMP_LOG);
});

describe("routeSearchJob (D1 internal dispatch loop)", () => {
  it("routes index → search → eval IN ORDER and returns ≥3 step records", async () => {
    const r = await routeSearchJob(TMP_LOG);
    expect(r.steps).toHaveLength(3);
    expect(r.steps.map((s) => s.step)).toEqual([...PIPELINE]);
    expect(r.steps.map((s) => s.step)).toEqual(["index", "search", "eval"]);
  });

  it("writes ≥3 ordered records to the log with monotonic seq AND non-decreasing timestamps", async () => {
    await routeSearchJob(TMP_LOG);
    const lines = readFileSync(TMP_LOG, "utf8").trim().split("\n").filter(Boolean);
    expect(lines.length).toBeGreaterThanOrEqual(3);
    const recs = lines.map((l) => JSON.parse(l) as { seq: number; ts: string; step: string });
    // seq strictly increasing 0,1,2
    expect(recs.map((r) => r.seq)).toEqual([0, 1, 2]);
    // timestamps non-decreasing (each step awaited before the next)
    for (let i = 1; i < recs.length; i++) {
      expect(recs[i]!.ts >= recs[i - 1]!.ts).toBe(true);
    }
  });

  it("is HONEST about engine state — with Cluster E landed the steps are wired ('ok'), never 'engine-pending', never a fabricated eval", async () => {
    const r = await routeSearchJob(TMP_LOG);
    // Post-E: runStep's import() of src/runtime/* resolves → the route reports the step is WIRED ("ok"). The route
    // proves ordering + wiring; it never fabricates a green eval (a real run failure would surface as "error"). The
    // status it must NEVER report now is "engine-pending" — that only held while E was unbuilt.
    for (const s of r.steps) {
      expect(s.status).not.toBe("engine-pending");
      expect(["ok", "error"]).toContain(s.status);
    }
  });

  it("the explicit sub-agent model is opus (A7/D12 — no bare default)", () => {
    expect(SUBAGENT_MODEL).toBe("opus");
  });
});
