import { describe, it, expect } from "vitest";
import { recallAtK, reciprocalRank, scoreEval, findRegressions } from "./eval-scorer.js";

describe("eval-scorer (Recall@10 / MRR / regression, O18/O19)", () => {
  it("recallAtK counts relevant docs in the top-k", () => {
    expect(recallAtK(["a", "b", "c", "d"], ["a", "c"], 10)).toBe(1);
    expect(recallAtK(["a", "b", "c", "d"], ["a", "z"], 10)).toBe(0.5);
    expect(recallAtK(["x", "y"], ["a"], 10)).toBe(0);
  });

  it("reciprocalRank is 1/(rank of first relevant)", () => {
    expect(reciprocalRank(["a", "b", "c"], ["b"])).toBeCloseTo(1 / 2, 10);
    expect(reciprocalRank(["a", "b", "c"], ["a"])).toBe(1);
    expect(reciprocalRank(["a", "b"], ["z"])).toBe(0);
  });

  it("scoreEval aggregates Recall@10, MRR, hit-rate across the golden set", () => {
    const golden = [
      { query: "q1", relevant: ["a"] },
      { query: "q2", relevant: ["x"] },
    ];
    const results = [
      { query: "q1", returned: ["a", "b"] }, // recall 1, rr 1, hit
      { query: "q2", returned: ["y", "x"] }, // recall 1, rr 0.5, hit
    ];
    const report = scoreEval(results, golden);
    expect(report.recallAt10).toBe(1);
    expect(report.mrr).toBeCloseTo((1 + 0.5) / 2, 10);
    expect(report.hitRate).toBe(1);
    expect(report.perQuery).toHaveLength(2);
  });

  it("G11 / S12: findRegressions catches a query whose recall DROPPED (the pet-query trap)", () => {
    const golden = [
      { query: "A", relevant: ["a"] },
      { query: "B", relevant: ["b"] },
    ];
    const baseline = scoreEval(
      [
        { query: "A", returned: ["z", "a"] }, // recall 1
        { query: "B", returned: ["b"] }, // recall 1
      ],
      golden,
    );
    const candidate = scoreEval(
      [
        { query: "A", returned: ["a"] }, // recall 1 (improved rank, same recall)
        { query: "B", returned: ["z"] }, // recall 0 — REGRESSED
      ],
      golden,
    );
    const regs = findRegressions(baseline, candidate);
    expect(regs).toHaveLength(1);
    expect(regs[0]!.query).toBe("B");
    expect(regs[0]!.delta).toBeLessThan(0);
  });

  it("no regression → empty array", () => {
    const golden = [{ query: "A", relevant: ["a"] }];
    const same = scoreEval([{ query: "A", returned: ["a"] }], golden);
    expect(findRegressions(same, same)).toHaveLength(0);
  });
});
