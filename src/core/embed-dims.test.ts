import { describe, it, expect } from "vitest";
import { adviseEmbedder } from "./embed-dims.js";

describe("adviseEmbedder (dims-vs-index-cap, O8/O9/S14)", () => {
  it("G13 / S14: --index-cap 2000 flags 3072-dim 3-large as over-cap and prescribes Matryoshka/halfvec", () => {
    const a = adviseEmbedder({ indexCap: 2000 });
    expect(a.overCap).toContain("openai/text-embedding-3-large");
    expect(a.dimsNote).toMatch(/Matryoshka|halfvec/);
  });

  it("O8: the golden set is ALWAYS required (MTEB shortlists, your corpus decides)", () => {
    const a = adviseEmbedder();
    expect(a.goldenSetRequired).toBe(true);
  });

  it("the boring default (3-small) leads the shortlist (O7)", () => {
    const a = adviseEmbedder();
    expect(a.shortlist[0]!.model).toMatch(/3-small/);
  });

  it("a 4000-dim halfvec cap lets 3-large (3072) fit — nothing over cap", () => {
    const a = adviseEmbedder({ indexCap: 4000 });
    expect(a.overCap).toHaveLength(0);
    expect(a.dimsNote).toMatch(/fit/);
  });

  it("longContext shifts the shortlist to long-context models", () => {
    const a = adviseEmbedder({ longContext: true });
    expect(a.shortlist.some((c) => /jina|bge-m3/i.test(c.model))).toBe(true);
  });
});
