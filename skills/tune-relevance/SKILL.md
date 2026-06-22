---
name: tune-relevance
description: Tune search relevance the right way — gate every change behind a corpus-wide golden set, never a pet query. Use when the user says "search relevance is wrong", "this query ranks badly", "boost recent/popular results", or "tune the ranking". Encodes the relevance-whack-a-mole law — a fix for one loud query can silently break a thousand others — and "search is never done".
brain_source: brain/EXPERTISE-MAP.md JTBD-5 · brain/OPINIONS.md O18/O19 · brain/BATTLE-TESTED-SCENARIOS.md S12 · brain/KNOWN-PITFALLS.md P13
---

# tune-relevance

> Encodes JTBD-5 (the continuous-tuning job). "Search is never done" is not a platitude — it's an
> architectural requirement `[O19]`. "Good search LOOKS effortless; it is the most expensive feature to
> maintain" `[EXPERTISE-MAP JTBD-5.2]`.

## Trigger

Fire when the request is: "search relevance is wrong", "this query ranks badly", "fix the ranking for <query>",
"boost recent / popular / in-stock results", "tune the ranking rules", or a stakeholder complains about ONE
specific query. The single-query complaint is the highest-risk trigger — it's exactly the pet-query trap
`[O18, S12]`.

## Steps

1. **Refuse the pet-query fix `[O18, S12; JTBD-5.1]`.** The #1 trap, verbatim from the field: "The biggest
   trap people fall into is tuning for one or a few 'pet' queries" — a fix for ONE query "can have cascading
   effects downstream that mess up the bulk of your other queries." Relevance is a GLOBAL optimization. Do NOT
   tweak the ranking function to perfect the complaint query and ship it.

2. **Require a corpus-wide golden set + per-query regression as the gate `[O18, O19; JTBD-5.3]`.** Before any
   ranking change ships, it must pass `truffle eval --suite golden` with **0 regressions** — a fix for query
   A that drops Recall@10 on queries B–Z is FLAGGED and blocked. If no golden set exists yet, building it is
   the prerequisite (`search-eval-loop`), not optional. The eval-scorer's per-query regression check is pure
   code, deterministic.

3. **Then tune with the per-engine levers `[EXPERTISE-MAP JTBD-5.4]`** — measuring each change against the
   golden set:
   - **Meilisearch** — reorder the **ranking-rules pipeline** (words → typo → proximity → attribute → sort →
     exactness). There's no BM25 k1/b knob; you reorder rules to make a custom field dominate.
   - **Typesense** — `query_by_weights`, the `_text_match`/`_vector_distance` pseudo-fields to inject business
     ranking (popularity/recency), synonyms, curation (`pinned_hits`/`hidden_hits`), decay functions
     (gaussian/linear/exp) for recency/geo boost.
   - **Elasticsearch** — boosts, RRF `rank_constant`, ELSER, `function_score`.
   - **Postgres** — DIY ranking expression in SQL.

4. **Treat RRF as the floor when relevance is revenue-critical `[O5, P13]`.** If metrics are below Recall@10
   85-91% / MRR > 0.80, there's tuning work — ship tiered boosting (all-term 100×, any-term 10×, vector
   fallback 0.1×) on top of fusion, gated on the golden metric. (RRF + a reranker is fine for "good enough RAG
   grounding" — depends on whether relevance is revenue-critical.)

5. **Accept the loop, not the one-shot `[O19; JTBD-5.3]`.** Ship the eval set + per-query regression + a
   continuous tuning loop — this IS Energy's RSI/observer pattern applied to search. Wire it into the
   version-bump suite so a later engine upgrade can't silently regress your tuned relevance (`search-eval-loop`).

## Output format

```
REFUSED:       <the pet-query fix that was rejected, and why>
GATE:          truffle eval --suite golden → must pass with 0 per-query regressions before shipping
LEVER:         <the per-engine lever applied — ranking rules / query_by_weights / boosts / SQL>
MEASURED:      <Recall@10 / MRR before → after, on the corpus-wide golden set>
REGRESSIONS:   <0, or the list of queries that regressed → change blocked>
LOOP:          <how this change is protected going forward — golden set + version-bump suite>
```

## Worked example

> **Request:** "Our biggest customer says searching 'premium' should put their premium-tier product first.
> Just boost it to the top."

1. **Refuse the pet-query fix** `[S12]`. Hard-boosting the "premium" query risks silently regressing the
   bulk of other queries (e.g. "premium leather case" now over-ranks the tier product). Relevance is global.
2. **Gate it:** run `truffle eval --suite golden` to capture the baseline, propose the boost as a *tiered*
   change, then re-run — any query whose Recall@10 drops is a regression that blocks the change.
3. **Lever (Meili):** rather than a raw boost, reorder ranking rules / add an attribute-rank so the tier field
   influences ranking *within* the eval gate.

```
REFUSED:       hard-pinning "premium" → premium-tier product (pet-query trap; would regress "premium <X>" queries)
GATE:          truffle eval --suite golden — baseline captured; change must ship with 0 regressions
LEVER:         Meili ranking-rules reorder (attribute rank on tier field) measured against the golden set
MEASURED:      "premium" MRR 0.42 → 0.91; corpus-wide Recall@10 0.88 → 0.88 (held)
REGRESSIONS:   0 — "premium leather case", "premium support" unaffected → change approved
LOOP:          golden set + per-query regression now guards this; re-runs in the version-bump suite on any engine upgrade
```
