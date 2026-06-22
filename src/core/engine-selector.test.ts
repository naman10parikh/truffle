import { describe, it, expect } from "vitest";
import { selectEngine } from "./engine-selector.js";

describe("selectEngine (corpus-size/control decision tree, O11-O15)", () => {
  it("THE B2 contract: 500k docs + multitenant → typesense with a non-empty reason", () => {
    const r = selectEngine({ corpusSize: 500_000, multitenant: true });
    expect(r.engine).toBe("typesense");
    expect(r.reason.length).toBeGreaterThan(0);
    expect(r.honestCost.length).toBeGreaterThan(0);
  });

  it("G14 / S16 litmus: tiny offline corpus → keeps in-house BM25 (does NOT stand up Meili)", () => {
    const r = selectEngine({ corpusSize: 300, offline: true });
    expect(r.engine).toBe("bm25-inhouse");
    expect(r.rejected.some((x) => /meilisearch/i.test(x))).toBe(true);
  });

  it("G12 / S13: small product corpus does NOT default to Elasticsearch", () => {
    const r = selectEngine({ corpusSize: 50_000 });
    expect(r.engine).toBe("meilisearch");
    expect(r.engine).not.toBe("elasticsearch");
    expect(r.rejected.some((x) => /elasticsearch/i.test(x))).toBe(true);
  });

  it("O15: Algolia is rejected on every decision (worst fit for an agent)", () => {
    const r = selectEngine({ corpusSize: 50_000 });
    expect(r.rejected.some((x) => /algolia/i.test(x))).toBe(true);
  });

  it("O13: ES/OpenSearch only at genuine scale + high ops appetite", () => {
    const small = selectEngine({ corpusSize: 1_000_000, opsAppetite: "high" });
    expect(small.engine).not.toBe("opensearch"); // 1M is NOT petabyte scale
    const huge = selectEngine({ corpusSize: 80_000_000, opsAppetite: "high" });
    expect(huge.engine).toBe("opensearch");
  });

  it("O12: already on Postgres → pgvector (one fewer service, acorn's box)", () => {
    const r = selectEngine({ corpusSize: 200_000, onPostgres: true });
    expect(r.engine).toBe("postgres");
    expect(r.honestCost).toMatch(/iterative_scan|0\.8/);
  });

  it("is deterministic — same input twice → identical result", () => {
    const a = selectEngine({ corpusSize: 500_000, multitenant: true });
    const b = selectEngine({ corpusSize: 500_000, multitenant: true });
    expect(a).toEqual(b);
  });
});
