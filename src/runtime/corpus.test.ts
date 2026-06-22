// src/runtime/corpus.test.ts — the fixture-corpus loader contract (E2 data spine: frontmatter + committed vectors).
//
// Pure, deterministic, no engine — the data layer the acceptance test rides on. A parsing/vector-attach bug here
// would silently mis-index, so these guard the fixture pipeline.

import { describe, it, expect } from "vitest";
import { loadCorpus, loadFixtureEmbeddings, loadFixtureQueryVectors, loadGoldenExpectations, FIXTURE_DIMS, defaultCorpusDir } from "./corpus.js";

describe("fixture corpus loader (E2)", () => {
  it("loads every fixture doc with id/category/title parsed from frontmatter", () => {
    const docs = loadCorpus(defaultCorpusDir());
    expect(docs.length).toBeGreaterThanOrEqual(8);
    const byId = new Map(docs.map((d) => [d.id, d]));
    // the load-bearing docs for the acceptance assertions
    expect(byId.get("d01")?.title).toMatch(/Kubernetes/i);
    expect(byId.get("d02")?.category).toBe("hardware");
    expect(byId.get("d04")?.body).toMatch(/0x80070005/);
  });

  it("attaches the committed fixture vector to each doc (FIXTURE_DIMS-dim)", () => {
    const docs = loadCorpus(defaultCorpusDir());
    for (const d of docs) {
      expect(d.vector, `doc ${d.id} must have a committed fixture vector`).toBeDefined();
      expect(d.vector!.length).toBe(FIXTURE_DIMS);
    }
  });

  it("loads the committed per-doc + per-query fixture embeddings", () => {
    const embeddings = loadFixtureEmbeddings();
    expect(Object.keys(embeddings).length).toBeGreaterThanOrEqual(8);
    expect(embeddings.d07!.length).toBe(FIXTURE_DIMS);
    const queries = loadFixtureQueryVectors();
    // the acceptance query + the paraphrase-proof query must have committed vectors
    expect(queries["kuburnetes RTX-4090 0x80070005"]!.length).toBe(FIXTURE_DIMS);
    expect(queries["remove containers from a node when it runs low on memory"]!.length).toBe(FIXTURE_DIMS);
  });

  it("loads the golden expectations with the required keys (judgements + proofs)", () => {
    const exp = loadGoldenExpectations();
    expect(exp.judgements.length).toBeGreaterThanOrEqual(5);
    // the silent-failure-class proofs the override requires
    expect(exp.hybridOrderingProof.hybridTopId).toBe("d07");
    expect(exp.hybridOrderingProof.bm25AloneTopId).toBe("d08");
    expect(exp.lexicalIdRanking.above).toBe("d02");
    expect(exp.lexicalIdRanking.below).toBe("d03");
  });

  it("the paraphrase-proof fixture vectors actually make d07 win the vector leg (the hybrid-flip is real, not asserted on faith)", () => {
    // Cosine-ish dot product on the committed vectors: the query vector must score d07 (eviction) ABOVE d08 (disk),
    // even though BM25 favours d08 (it has the literal query words). This proves the fixture DESIGN, not the engine.
    const emb = loadFixtureEmbeddings();
    const q = loadFixtureQueryVectors()["remove containers from a node when it runs low on memory"]!;
    const dot = (a: number[], b: number[]) => a.reduce((s, x, i) => s + x * (b[i] ?? 0), 0);
    const d07 = dot(emb.d07!, q);
    const d08 = dot(emb.d08!, q);
    expect(d07).toBeGreaterThan(d08);
  });
});
