// fusion.ts — hybrid rank fusion (deterministic, pure math, NOT an LLM call).
//
// Encodes O5: RRF is the FLOOR (naive RRF is only ~+1.3% over BM25 on WANDS); the real lift (~+7.5%) comes from
// tier/boost tuning ON TOP of fusion. So truffle ships RRF as the baseline AND a tiered-boost mode — never stops
// at RRF and calls relevance done. Source: brain/OPINIONS.md O5 · brain/BATTLE-TESTED-SCENARIOS.md S3 · field-01 §2.

/** The canonical RRF constant. k≈60 is the literature floor (Cormack et al.); truffle pins 60. */
export const RRF_K = 60;

/** A single engine's ranked result list: doc ids in descending relevance (rank 1 = first element). */
export type RankList = string[];

export interface FusedHit {
  id: string;
  /** The fused score (higher = better). For RRF this is Σ 1/(k+rank); for tiered it adds the boost weight. */
  score: number;
}

/** A relevance tier for the tiered-boost mode: a set of doc ids and the multiplier their RRF contribution gets. */
export interface Tier {
  ids: string[];
  /** O5's tiered weights: exact/lexical-ID ≈ 100×, strong ≈ 10×, weak/penalize ≈ 0.1×. */
  boost: number;
}

/**
 * Reciprocal Rank Fusion over N ranked lists. Deterministic: same lists → same fused order.
 * RRF score for a doc = Σ over lists of 1/(k + rank), rank 1-based. Ties broken by id (stable, lexicographic).
 *
 * This is the FLOOR (O5) — correct, robust, score-scale-free, but only the baseline. Tune with `tieredFuse`.
 */
export function rrf(lists: RankList[], k: number = RRF_K): FusedHit[] {
  const scores = new Map<string, number>();
  for (const list of lists) {
    for (let i = 0; i < list.length; i++) {
      const id = list[i];
      if (id === undefined) continue;
      const rank = i + 1; // 1-based
      scores.set(id, (scores.get(id) ?? 0) + 1 / (k + rank));
    }
  }
  return [...scores.entries()]
    .map(([id, score]) => ({ id, score }))
    .sort((a, b) => (b.score !== a.score ? b.score - a.score : a.id.localeCompare(b.id)));
}

/**
 * Tiered-boost fusion (O5's real-lift mode): start from RRF, then multiply each doc's fused score by the boost of
 * the tier it lands in (exact lexical-ID matches ≈100×, strong ≈10×, weak/penalize ≈0.1×). The tier-tuning is what
 * takes hybrid from +1.3% (naive RRF) to +7.5% — gated on a golden set, never shipped untested (O5, O18).
 * Deterministic. A doc not in any tier keeps boost 1× (its plain RRF score).
 */
export function tieredFuse(lists: RankList[], tiers: Tier[], k: number = RRF_K): FusedHit[] {
  const boostOf = new Map<string, number>();
  for (const tier of tiers) for (const id of tier.ids) boostOf.set(id, tier.boost);

  const base = rrf(lists, k);
  return base
    .map(({ id, score }) => ({ id, score: score * (boostOf.get(id) ?? 1) }))
    .sort((a, b) => (b.score !== a.score ? b.score - a.score : a.id.localeCompare(b.id)));
}

/** The fusion modes truffle exposes via the CLI/MCP. `weighted` is a simple linear blend (the naive alternative). */
export type FusionMethod = "rrf" | "weighted" | "tiered";

/**
 * Linear weighted fusion over per-list normalized scores — the naive alternative truffle can emit but does NOT
 * default to (RRF is score-scale-free; weighted needs score normalization and is brittle across engines). Provided
 * for completeness so `truffle hybrid fuse --method weighted` is real. Weights default to equal. Deterministic.
 */
export function weightedFuse(scoredLists: Array<Array<{ id: string; score: number }>>, weights?: number[]): FusedHit[] {
  const fused = new Map<string, number>();
  for (let li = 0; li < scoredLists.length; li++) {
    const list = scoredLists[li] ?? [];
    const w = weights?.[li] ?? 1;
    const max = Math.max(1e-9, ...list.map((x) => x.score)); // min-guard avoids /0
    for (const { id, score } of list) {
      fused.set(id, (fused.get(id) ?? 0) + (score / max) * w);
    }
  }
  return [...fused.entries()]
    .map(([id, score]) => ({ id, score }))
    .sort((a, b) => (b.score !== a.score ? b.score - a.score : a.id.localeCompare(b.id)));
}
