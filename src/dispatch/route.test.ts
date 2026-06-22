// src/dispatch/route.test.ts — D1 routing-loop contract: ordered, ≥3 steps, honest engine state.

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

  it("is HONEST about engine state — engine-touching steps are 'engine-pending', never a fabricated 'ok' eval", async () => {
    const r = await routeSearchJob(TMP_LOG);
    // Cluster E isn't built yet → every step honestly reports engine-pending (NOT a fake green eval).
    for (const s of r.steps) {
      expect(s.status).toBe("engine-pending");
    }
  });

  it("the explicit sub-agent model is opus (A7/D12 — no bare default)", () => {
    expect(SUBAGENT_MODEL).toBe("opus");
  });
});
