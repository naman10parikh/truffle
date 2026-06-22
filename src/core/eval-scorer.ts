// eval-scorer.ts — the relevance metrics (Recall@10 / MRR / hit-rate) + per-query regression (deterministic).
//
// The relevance proof, as PURE CODE (not an LLM judge — the LLM judge is an INPUT, never the gate; dsip
// noSelfGrading, DISPUTE D). These are the load-bearing observability fields (O18/O19 — "search is never done";
// a fix for query A must not silently regress B-Z). Source: brain/OPINIONS.md O18/O19/O20 · BATTLE-TESTED S12.

/** One golden judgement: a query and the set of doc ids that are TRULY relevant for it. */
export interface GoldenJudgement {
  query: string;
  /** The relevant doc ids (the ground truth — a human/behavior label, NOT an LLM's opinion, per DISPUTE D). */
  relevant: string[];
}

/** What an engine actually returned for a query: the ranked doc ids (rank 1 first). */
export interface QueryResult {
  query: string;
  returned: string[];
}

export interface EvalReport {
  /** Mean Recall@10 across the golden set. */
  recallAt10: number;
  /** Mean Reciprocal Rank (first relevant hit) across the golden set. */
  mrr: number;
  /** Fraction of queries with ≥1 relevant doc anywhere in the returned list. */
  hitRate: number;
  /** Per-query metrics (for the regression view + the runs.jsonl record). */
  perQuery: Array<{ query: string; recallAt10: number; reciprocalRank: number; hit: boolean }>;
}

/** Recall@k for one query: |relevant ∩ top-k returned| / |relevant|. Returns 1 when there are no relevant docs. */
export function recallAtK(returned: string[], relevant: string[], k: number): number {
  if (relevant.length === 0) return 1;
  const topK = new Set(returned.slice(0, k));
  let hits = 0;
  for (const id of relevant) if (topK.has(id)) hits += 1;
  return hits / relevant.length;
}

/** Reciprocal rank for one query: 1/(rank of the first relevant doc), or 0 if none returned. */
export function reciprocalRank(returned: string[], relevant: string[]): number {
  const rel = new Set(relevant);
  for (let i = 0; i < returned.length; i++) {
    const id = returned[i];
    if (id !== undefined && rel.has(id)) return 1 / (i + 1);
  }
  return 0;
}

/**
 * Score a set of query results against the golden judgements. Deterministic. Queries with no matching golden
 * judgement are skipped (you can only score what you have ground truth for).
 */
export function scoreEval(results: QueryResult[], golden: GoldenJudgement[]): EvalReport {
  const goldenByQuery = new Map(golden.map((g) => [g.query, g.relevant]));
  const perQuery: EvalReport["perQuery"] = [];

  for (const r of results) {
    const relevant = goldenByQuery.get(r.query);
    if (relevant === undefined) continue;
    const recall = recallAtK(r.returned, relevant, 10);
    const rr = reciprocalRank(r.returned, relevant);
    const hit = rr > 0;
    perQuery.push({ query: r.query, recallAt10: recall, reciprocalRank: rr, hit });
  }

  const n = perQuery.length || 1; // guard /0 on an empty set
  const recallAt10 = perQuery.reduce((s, q) => s + q.recallAt10, 0) / n;
  const mrr = perQuery.reduce((s, q) => s + q.reciprocalRank, 0) / n;
  const hitRate = perQuery.filter((q) => q.hit).length / n;

  return { recallAt10, mrr, hitRate, perQuery };
}

/**
 * Per-query regression: compare a candidate run against a baseline run query-by-query (O18/S12 — the pet-query
 * trap). Returns every query whose Recall@10 DROPPED, with the (negative) delta. An empty array = no regression.
 * Deterministic. This is the check that refuses to pass a ranking change that silently breaks other queries.
 */
export function findRegressions(
  baseline: EvalReport,
  candidate: EvalReport,
  minDrop = 1e-9,
): Array<{ query: string; delta: number }> {
  const baseByQuery = new Map(baseline.perQuery.map((q) => [q.query, q.recallAt10]));
  const regressions: Array<{ query: string; delta: number }> = [];
  for (const q of candidate.perQuery) {
    const before = baseByQuery.get(q.query);
    if (before === undefined) continue;
    const delta = q.recallAt10 - before;
    if (delta < -minDrop) regressions.push({ query: q.query, delta });
  }
  return regressions.sort((a, b) => a.delta - b.delta); // worst regression first
}
