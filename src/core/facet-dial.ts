// facet-dial.ts — faceting-at-scale as a SYSTEMS problem with cost dials (deterministic, pure code).
//
// Encodes O16/O17: faceting is NOT "GROUP BY + COUNT" — one high-cardinality facet collapsed a real ES cluster
// 400 → 20-30 QPS (the global-ordinals tax). The real model is a single pass over the matched set with cost dials:
// cardinality reduction, count-cap ("500+"), terminate_after/size:0, sampling (>100k matched), and multi-select
// exclusion. Great engineers make the correctness-vs-performance tradeoff explicitly (the Vinted playbook).
// Source: brain/OPINIONS.md O16/O17 · brain/BATTLE-TESTED-SCENARIOS.md S5 · field-02 §1/§2 · field-05 §2.

/** One cost dial: the lever to pull, the value to set, and the tradeoff it makes (the §4 facet_plan shape). */
export interface FacetDial {
  lever: string;
  value: string;
  /** What you give up by pulling this dial (O17 — never pretend exact counts at scale are free). */
  tradeoff: string;
}

export interface FacetPlanInput {
  field: string;
  /** Distinct value count for this facet field — the primary cost axis. */
  cardinality: number;
  /** Matched-set size the facet is computed over (defaults to "unknown/large" handling). */
  resultSet?: number;
}

export interface FacetPlan {
  field: string;
  /** TRUE if this facet is cheap to compute as-is (low cardinality, small matched set) — no dials needed. */
  safe: boolean;
  dials: FacetDial[];
  /** One-line systems framing (O16) so the caller never ships naive GROUP BY + COUNT. */
  note: string;
}

// Thresholds from the brain (Vinted playbook, S5): high-cardinality starts to hurt ~10k; sampling earns its
// approximation past ~100k matched docs; count-cap ("500+") is the standard correctness-vs-perf trade.
const HIGH_CARDINALITY = 10_000;
const SAMPLING_THRESHOLD = 100_000;
const COUNT_CAP = 500;

/**
 * Produce the facet-at-scale plan: the ordered cost dials to pull for a field of the given cardinality over the
 * given matched set. Deterministic. A low-cardinality facet over a small matched set returns `safe: true` with no
 * dials (don't over-engineer a category facet with 5 values).
 */
export function planFacet(input: FacetPlanInput): FacetPlan {
  const { field, cardinality, resultSet } = input;
  const dials: FacetDial[] = [];

  // Multi-select exclusion is ALWAYS the correct default for a real faceted UI (O16) — counts for OTHER values
  // must stay live when one value is selected, or the user gets dead-end facets.
  dials.push({
    lever: "multi-select-exclusion",
    value: "exclude the active facet's own filter when computing its counts",
    tradeoff: "a second constrained pass (or post-filter) per active facet — the cost of a non-dead-end UI (O16)",
  });

  // High cardinality → reduce the cardinality first (the single biggest lever; Vinted cut 2M→40K → ~15ms P99).
  if (cardinality > HIGH_CARDINALITY) {
    dials.push({
      lever: "cardinality-reduction",
      value: `bucket/normalize ${cardinality.toLocaleString()} distinct values down toward ≤ ${HIGH_CARDINALITY.toLocaleString()} (Vinted: 2M→40K)`,
      tradeoff: "coarser facet granularity; some long-tail values merge into an 'other' bucket (S5)",
    });
    dials.push({
      lever: "count-cap",
      value: `display counts as "${COUNT_CAP}+" once a value's count exceeds ${COUNT_CAP}`,
      tradeoff: "exact counts above the cap are hidden — users rarely need '4,217', '500+' is enough (O17)",
    });
    dials.push({
      lever: "terminate_after / size:0",
      value: "compute facet counts with size:0 (counts only, no hits) and terminate_after to bound the scan",
      tradeoff: "counts can be approximate when the scan is bounded — an explicit correctness-for-throughput trade (O16)",
    });
  }

  // Very large matched set → sampling (approximate counts) is the only way to keep faceting cheap (Typesense did this).
  if (resultSet !== undefined && resultSet > SAMPLING_THRESHOLD) {
    dials.push({
      lever: "facet-sampling",
      value: `sample the matched set (Typesense facet sampling) above ${SAMPLING_THRESHOLD.toLocaleString()} matched docs`,
      tradeoff: "counts are approximate — accepted deliberately for throughput at scale, never silently (O17)",
    });
  }

  const safe = cardinality <= HIGH_CARDINALITY && (resultSet === undefined || resultSet <= SAMPLING_THRESHOLD);

  return {
    field,
    safe,
    dials: safe ? [dials[0] as FacetDial] : dials, // even safe facets keep multi-select exclusion
    note: safe
      ? `Field "${field}" is low-cardinality (${cardinality}) over a modest matched set — cheap as a single-pass facet; keep multi-select exclusion, no other dials needed (don't over-engineer).`
      : `Field "${field}" is a SYSTEMS problem (cardinality ${cardinality.toLocaleString()}${resultSet !== undefined ? `, matched ${resultSet.toLocaleString()}` : ""}): pull the dials in order — naive GROUP BY + COUNT here is the 400→20 QPS collapse (O16, S5).`,
  };
}
