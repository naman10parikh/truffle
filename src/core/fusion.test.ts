import { describe, it, expect } from "vitest";
import { rrf, tieredFuse, weightedFuse, RRF_K } from "./fusion.js";

describe("rrf (the RRF floor, O5)", () => {
  it("pins k=60", () => {
    expect(RRF_K).toBe(60);
  });

  it("with k=60 on two known rank lists yields the documented fused order", () => {
    // BM25 leg ranks: A, B, C. Vector leg ranks: B, A, D.
    // RRF scores (k=60):
    //   A: 1/61 + 1/62 = 0.016393 + 0.016129 = 0.032522
    //   B: 1/62 + 1/61 = 0.032522 (same pair → tie with A; broken lexicographically → A before B)
    //   C: 1/63           = 0.015873
    //   D: 1/63           = 0.015873  (tie with C → C before D lexicographically)
    // Documented fused order: A, B, C, D.
    const bm25 = ["A", "B", "C"];
    const vector = ["B", "A", "D"];
    const fused = rrf([bm25, vector], 60);
    expect(fused.map((h) => h.id)).toEqual(["A", "B", "C", "D"]);
    // A and B tie on score; C and D tie on score.
    expect(fused[0]!.score).toBeCloseTo(fused[1]!.score, 10);
    expect(fused[2]!.score).toBeCloseTo(fused[3]!.score, 10);
    expect(fused[0]!.score).toBeGreaterThan(fused[2]!.score);
  });

  it("defaults k to RRF_K when omitted", () => {
    const a = rrf([["x", "y"]]);
    const b = rrf([["x", "y"]], 60);
    expect(a).toEqual(b);
  });
});

describe("tieredFuse (O5 — the real lift ON TOP of RRF)", () => {
  it("a 100× exact-match boost lifts a lexical-ID doc above a higher-RRF doc", () => {
    const bm25 = ["sku-doc", "near-doc"];
    const vector = ["near-doc", "sku-doc"]; // near-doc is rank 1 in vector → higher plain RRF
    // Without tiers, near-doc and sku-doc tie. Boost the exact lexical-ID match 100×.
    const fused = tieredFuse([bm25, vector], [{ ids: ["sku-doc"], boost: 100 }]);
    expect(fused[0]!.id).toBe("sku-doc");
    expect(fused[0]!.score).toBeGreaterThan(fused[1]!.score);
  });

  it("a doc in no tier keeps its plain RRF score (1× boost)", () => {
    const plain = rrf([["a", "b"]]);
    const tiered = tieredFuse([["a", "b"]], [{ ids: ["zzz"], boost: 100 }]);
    expect(tiered.map((h) => h.id)).toEqual(plain.map((h) => h.id));
  });
});

describe("weightedFuse (the naive alternative, provided not defaulted)", () => {
  it("blends normalized scores and ranks by the blend", () => {
    const l1 = [{ id: "a", score: 10 }, { id: "b", score: 5 }];
    const l2 = [{ id: "b", score: 8 }, { id: "a", score: 2 }];
    const fused = weightedFuse([l1, l2]);
    // a: 10/10 + 2/8 = 1.25 ; b: 5/10 + 8/8 = 1.5 → b first.
    expect(fused[0]!.id).toBe("b");
  });
});
