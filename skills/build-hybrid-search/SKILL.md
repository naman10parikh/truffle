---
name: build-hybrid-search
description: Add hybrid (BM25 + vector + fusion) search and prove it beats pure vector. Use when the user asks to "add hybrid search", "combine keyword and vector", "improve search relevance", or reports that "semantic search is failing on codes/SKUs/error codes". Encodes the 2026 retrieval consensus — pure vector LOST; hybrid covers complementary failure modes; you MUST test the lexical-ID query class, not just paraphrase.
brain_source: brain/EXPERTISE-MAP.md JTBD-2 · brain/OPINIONS.md O3/O4/O5 · brain/BATTLE-TESTED-SCENARIOS.md S1/S3/S15
---

# build-hybrid-search

> Encodes JTBD-2 (the core 2026 retrieval job). The production argument stopped being "which one is better"
> years ago — "it's now entirely about how precisely you understand where each one fails" `[EXPERTISE-MAP
> JTBD-2.1]`. Pure vector LOST the war on real e-commerce data (WANDS): pure KNN ~0.6953 NDCG **lost** to
> BM25 ~0.6983; hybrid beat both `[O3, S1]`.

## Trigger

Fire when the request is: "add hybrid search", "combine keyword and vector", "semantic / vector search is
failing on codes / SKUs / error codes / function names", "improve search relevance", or "should we go
semantic-only". Also fire defensively when someone pitches **pure vector search as strictly better** — that's
the S1 trap this skill catches.

## Steps

1. **Refuse pure-vector-only; insist on hybrid `[O3, S1]`.** Name the dense-failure classes out loud so the
   team sees the silent-failure surface: **error codes** (`0x80070005` → embeddings treat as noise),
   **product SKUs** (`RTX-4090` vs `RTX-4070` cluster as near-identical), **function/library names**
   (`torch.nn.functional.cross_entropy`), and **rare named entities** (signal averaged away by pooling). A
   demo that nails "find docs about authentication" can completely fail "find docs mentioning `0x80070005`."

2. **Test the lexically-specific query class, not just paraphrase `[O4]`.** Before shipping, build a test set
   that includes codes/SKUs/API-names/IDs — exactly the class where pure vector silently fails. This is
   non-negotiable: paraphrase-only validation hides the failure mode (`search-eval-loop` enforces this in the
   golden set).

3. **Emit the per-engine hybrid query `[EXPERTISE-MAP JTBD-2.7]`** via `truffle hybrid design --engine <e>`:
   - **Typesense** — put both fields in `query_by` (`query_by: "text,embedding"` → auto-fused Rank Fusion),
     or `vector_query` for BYO-vector with a `distance_threshold` to cut weak semantic matches.
   - **Meilisearch** — `hybrid: { embedder, semanticRatio }` (the explicit 0→1 keyword↔semantic knob).
   - **Elasticsearch** — a `retriever` with `standard`(BM25) + `knn`(vector) legs fused by `rrf`
     (rank_constant ~60).
   - **Postgres** — two CTEs (pg_search BM25 + pgvector ANN) fused with `1.0/(60+rank)` RRF in SQL.

4. **Compute the fusion, and treat RRF as the FLOOR `[O5, S3]`.** Run `truffle hybrid fuse --method rrf`
   (k≈60) as the floor. On WANDS, naive RRF is only **+1.3% over BM25**; the real lift (**+7.5%**) comes from
   tiered boost tuning ON TOP of fusion (`--method tiered` → all-term 100×, any-term 10×, vector fallback
   0.1×). Average engineers ship RRF and stop; great ones tune the tiers — **gated on a golden set** (never a
   pet query, `tune-relevance`).

5. **Watch the symbols+hybrid scoring bug `[S15, P16]`.** If you're indexing code/identifiers and need symbols
   indexed, test the exact `symbols_to_index` + hybrid combo on the target engine/version — Typesense v28+
   silently produced wrong scores there (#2365, OPEN). Fall back to a keyword-only (BM25) leg for the code
   field + a separate vector leg, or pin a working version.

## Output format

```
DECISION:      hybrid (BM25 + vector + fusion) — NOT pure vector
FAILURE CLASS: <the dense-failure classes named: codes / SKUs / API-names / rare-entities>
QUERY:         <the copy-paste per-engine hybrid query template>
FUSION:        RRF k=60 (the FLOOR) → tiered boost if relevance is revenue-critical (+7.5% vs +1.3%)
LEXICAL TEST:  <confirmation the golden set includes the lexical-ID class, not just paraphrase>
TARGET:        Recall@10 85-91% · MRR > 0.80 · Hit Rate@10 > 90% on YOUR corpus
```

## Worked example

> **Request:** "Our semantic search nails natural-language questions but users complain it can't find docs by
> error code or GPU model. Should we just tune the embeddings?"

1. This is the S1 trap. The fix is NOT better embeddings — it's hybrid. Error codes (`0x80070005`) and SKUs
   (`RTX-4090` vs `RTX-4070`) are exactly the dense-failure class; embeddings average them away `[O4]`.
2. Build a lexical-ID test set: the `0x80070005` doc, the `RTX-4090` vs `RTX-4070` ranking pair.
3. `truffle hybrid design --engine meili` → `hybrid: { embedder: "default", semanticRatio: 0.5 }` (BM25 leg
   catches the exact codes/SKUs the vector leg misses).
4. `truffle hybrid fuse --method rrf` as the floor; if this is revenue-critical product search, tune tiers.

```
DECISION:      hybrid (BM25 + vector + fusion) — NOT pure vector, NOT "tune the embeddings"
FAILURE CLASS: error codes (0x80070005), SKUs (RTX-4090 vs RTX-4070), function names, rare entities
QUERY:         Meili → search({ q, hybrid: { embedder, semanticRatio: 0.5 } })   # BM25 leg recovers the lexical-ID hits
FUSION:        RRF k=60 floor; tier-boost only if relevance is revenue-critical (S3: +7.5% vs naive +1.3%)
LEXICAL TEST:  golden set now includes the 0x80070005 doc + the RTX-4090>RTX-4070 ordering pair (not paraphrase-only)
TARGET:        Recall@10 85-91% · MRR > 0.80 on the docs corpus
```
