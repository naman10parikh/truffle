// src/runtime/run-log.test.ts — the E3 observability writer contract (the load-bearing relevance-verdict line).
//
// §10 override: the load-bearing fields are the RELEVANCE VERDICT (recall_at_10/mrr/hit_rate) + engine + fusion.
// This asserts logRun appends a parseable JSON line carrying exactly those fields (the signal the RSI loop acts on).

import { describe, it, expect, afterEach } from "vitest";
import { readFileSync, rmSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { logRun } from "./run-log.js";

const TMP_LOG = join(tmpdir(), `truffle-runlog-test-${process.pid}.jsonl`);
afterEach(() => {
  if (existsSync(TMP_LOG)) rmSync(TMP_LOG);
});

describe("run-log writer (E3 / Observability §10)", () => {
  it("appends a parseable JSON line carrying the relevance verdict + engine + fusion", () => {
    logRun({ kind: "eval", suite: "golden", engine: "meilisearch", fusion: "hybrid", recall_at_10: 1, mrr: 1, hit_rate: 1, regressions: 0 }, TMP_LOG);
    const line = readFileSync(TMP_LOG, "utf8").trim().split("\n").pop()!;
    const rec = JSON.parse(line) as Record<string, unknown>;
    // the load-bearing override fields
    expect(rec.recall_at_10).toBe(1);
    expect(rec.mrr).toBe(1);
    expect(rec.hit_rate).toBe(1);
    expect(rec.engine).toBe("meilisearch");
    expect(rec.fusion).toBe("hybrid");
    // stamps a ts automatically
    expect(typeof rec.ts).toBe("string");
  });

  it("appends (does not overwrite) — multiple runs accumulate", () => {
    logRun({ kind: "eval", recall_at_10: 0.9 }, TMP_LOG);
    logRun({ kind: "eval", recall_at_10: 1.0 }, TMP_LOG);
    const lines = readFileSync(TMP_LOG, "utf8").trim().split("\n").filter(Boolean);
    expect(lines.length).toBe(2);
  });
});
