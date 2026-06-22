import { describe, it, expect } from "vitest";
import { planFacet } from "./facet-dial.js";

describe("planFacet (faceting as a systems problem, O16/O17)", () => {
  it("G5: a high-cardinality facet gets cardinality-reduction + count-cap + terminate_after dials", () => {
    const p = planFacet({ field: "brand", cardinality: 2_000_000, resultSet: 50_000 });
    expect(p.safe).toBe(false);
    const levers = p.dials.map((d) => d.lever);
    expect(levers).toContain("cardinality-reduction");
    expect(levers).toContain("count-cap");
    expect(levers).toContain("terminate_after / size:0");
    // every dial states its tradeoff (O17 — never pretend exact counts are free)
    expect(p.dials.every((d) => d.tradeoff.length > 0)).toBe(true);
  });

  it("a very large matched set adds facet-sampling", () => {
    const p = planFacet({ field: "brand", cardinality: 2_000_000, resultSet: 500_000 });
    expect(p.dials.map((d) => d.lever)).toContain("facet-sampling");
  });

  it("a low-cardinality facet over a small set is safe — only multi-select exclusion, no over-engineering", () => {
    const p = planFacet({ field: "category", cardinality: 5, resultSet: 1_000 });
    expect(p.safe).toBe(true);
    expect(p.dials).toHaveLength(1);
    expect(p.dials[0]!.lever).toBe("multi-select-exclusion");
  });

  it("multi-select exclusion is ALWAYS present (no dead-end facets, O16)", () => {
    const big = planFacet({ field: "brand", cardinality: 2_000_000 });
    const small = planFacet({ field: "category", cardinality: 5 });
    expect(big.dials.some((d) => d.lever === "multi-select-exclusion")).toBe(true);
    expect(small.dials.some((d) => d.lever === "multi-select-exclusion")).toBe(true);
  });
});
