---
title: "Search Ecosystem — Embeddings, Reranking & RAG Retrieval (June 2026)"
type: source
created: "2026-06-17"
updated: "2026-06-17"
tags: [embeddings, reranking, rag, retrieval, voyage, cohere, openai, mteb, bm25, hybrid, semantic]
summary: "Embedding model spec table (dims/price/MTEB), reranker landscape with NDCG numbers, BM25-vs-semantic-vs-hybrid taste, and the two-stage retrieve→rerank RAG pattern. Hard numbers, not vibes."
researcher: "truffle ECOSYSTEM (CP123 Wave-R)"
---

# Embeddings, Reranking & RAG Retrieval (June 2026)

---

## 1. EMBEDDING MODELS — the spec table (verified April 2026)
Source: https://pecollective.com/tools/text-embedding-models-compared/ (accessed 2026-06-17;
prices verified against official docs as of Apr 2026; MTEB = English retrieval subset of the
public leaderboard). NOTE: vendor "own benchmark" claims (e.g. Voyage's RTEB) are separate and
self-serving — I flag those as vendor-marketing, not neutral.

| Model | Provider | Dims | $/1M tok | Max tokens | MTEB avg |
|---|---|---|---|---|---|
| text-embedding-3-small | OpenAI | 1,536 | $0.02 | 8,191 | 62.3 |
| text-embedding-3-large | OpenAI | 3,072 | $0.13 | 8,191 | 64.6 |
| embed-v4 | Cohere | 1,024 | $0.10 | 512 | 66.3 |
| voyage-3-large | Voyage AI | 1,024 | $0.18 | 32,000 | 67.1 |
| voyage-3-lite | Voyage AI | 512 | $0.02 | 32,000 | 61.4 |
| jina-embeddings-v3 | Jina AI | 1,024 | $0.02 | 8,192 | 65.5 |
| text-embedding-004 | Google | 768 | Free / $0.025 | 2,048 | 63.0 |
| BGE-large-en-v1.5 | BAAI (OSS) | 1,024 | Free (self-host) | 512 | 63.6 |
| E5-large-v2 | Microsoft (OSS) | 1,024 | Free (self-host) | 512 | 62.0 |
| GTE-large-en-v1.5 | Alibaba (OSS) | 1,024 | Free (self-host) | 8,192 | 65.4 |
| nomic-embed-text-v1.5 | Nomic (OSS) | 768 | Free (OSS) | 8,192 | 62.3 |

### Taste / explicit picks (synthesized from the source's framework + cross-checks)
- **Safe default:** OpenAI `text-embedding-3-small` — most-integrated, cheapest commercial,
  "good enough for 90% of apps." Every vector DB supports it out of the box.
- **Best price/quality:** **Jina v3** at $0.02/1M scoring 65.5 — outperforms OpenAI's LARGE
  model at 1/6 the price, and it's open-weight (self-hostable). The sleeper pick.
- **Best quality + long context:** **voyage-3-large** (67.1 MTEB, **32K token context** — the
  ONLY major embedder that can ingest a whole paper in one call). Premium ($0.18/1M) but
  embedding cost is negligible at most scales (1M docs ≈ $90).
- **Free tier:** Google `text-embedding-004` (free on Gemini tier, 63.0 MTEB) — fine if
  already on Google.
- **Self-host:** GTE-large-en-v1.5 (65.4, 8K ctx) or nomic-v1.5. Break-even vs API ≈
  10-15M embeddings/month (an A10G ~$0.75/hr does 500-1000 emb/s).

### Embedding gotchas the source calls out (the load-bearing details)
- **Matryoshka embeddings** (OpenAI, Cohere): request fewer dims (256/512/1024) → truncated
  vector that still works → cheaper storage. Critical because **pgvector HNSW caps at 2000
  dims** (4000 with halfvec) — so OpenAI 3-large at 3072 dims CANNOT be HNSW-indexed unless
  you truncate via the `dimensions` param. (Cross-ref: issues file pgvector #461.)
- **Storage math:** 1024-dim float32 = 4KB/vector → 10M docs = 40GB vector storage. Dims
  drive your vector-DB bill far more than the embedding API bill.
- **Chunk size > max-context:** shorter chunks (256-512 tok) often retrieve BETTER than
  embedding whole docs, so a big context window matters less than vendors imply.
- **Cohere embed-v4 has a 512-token cap** AND distinct `search_document` vs `search_query`
  input types (asymmetric embedding — embed docs and queries differently). Meili/Typesense
  support this via separate index-time vs search-time embedders (Meili 2026 feature).
- **MTEB is gameable:** a 5-pt MTEB gap ≈ only 3-8% recall@10 in production. Models tuned ON
  MTEB overfit. ALWAYS eval on YOUR corpus, not the leaderboard. (See GAPS — every neutral
  source repeats this; vendor "we beat X by 14%" claims use their OWN benchmark.)

---

## 2. RERANKING — the second stage that actually moves the needle
Source: https://zeroentropy.dev/articles/ultimate-guide-to-choosing-the-best-reranking-model-in-2025/
(accessed 2026-06-17 — note: ZeroEntropy is a reranker VENDOR, so their "we beat Cohere"
numbers are self-serving; the cross-encoder/architecture facts and the Databricks/MIT cites
are neutral). Cross-ref: https://cohere.com/rerank, AWS Cohere-rerank blog.

### What a reranker IS (the mental model)
- **Bi-encoder (embeddings):** encode query and doc SEPARATELY into vectors, compare by
  cosine. Fast (precompute doc vectors), scales to millions, but loses query↔doc interaction.
- **Cross-encoder (reranker):** feed the FULL (query, doc) PAIR through one model together →
  a single relevance score. Much more accurate (sees the interaction) but CAN'T precompute —
  you run it at query time on a SHORTLIST. So you can't rerank millions, only the top-N
  (typically 50-200) that stage-1 retrieval returned.
- This is THE two-stage RAG pattern: **stage 1** = cheap recall (BM25 / vector / hybrid) pulls
  top ~100; **stage 2** = expensive precision (cross-encoder reranker) reorders to top ~5-10
  that go into the LLM context.

### The reranker landscape (June 2026)
| Reranker | Type | NDCG@10 | Latency | $/1M tok | Notes |
|---|---|---|---|---|---|
| ZeroEntropy zerank-1 | cross-enc | 0.85+ | ~60ms | $0.025 | vendor claims +18% NDCG@10 vs Cohere rerank-3 on finance (their bench) |
| Cohere rerank-3 / rerank-3.5 | cross-enc | strong | ~100ms | (API) | the easy drop-in default; strong multilingual; closed |
| Voyage rerank-2 | cross-enc | strong | — | (API) | instruction-following; good for agent/conversational |
| Jina reranker (v2) | cross-enc | — | — | OSS-weights | open-weight, multimodal (images/PDFs) |
| Salesforce Llama-rerank | cross-enc | — | higher | OSS | 4B/8B Llama-based, heavier |
| BGE-reranker (v2-m3) | cross-enc | — | — | Free (OSS) | the standard self-hosted reranker |

### Reranking ROI — the hard numbers (neutral cites)
- **Databricks:** reranking improves retrieval quality by **up to 48%**.
- **MIT study** (cross-encoder two-stage): cross-encoder reranking "significantly outperforms
  single-stage vector search"; the ailog writeup headlines **+40% RAG accuracy**.
- Reranking + filtering before the LLM call: **72% LLM-cost reduction while preserving 95% of
  full-model accuracy** (ZeroEntropy's worked example: passing 75 candidates × 500 tok at 10
  qps = $162k/day naive → $44k/day with rerank-then-trim).
- Reduces hallucinations ~35% vs raw embedding similarity (per the guide).

### When reranking is WORTH it (taste)
- Worth it: ambiguous queries, compliance/precision-critical retrieval, and any RAG where you
  pay an LLM per retrieved token (rerank → fewer, better chunks → big LLM savings).
- Skip it: tiny corpora where stage-1 already returns near-perfect top-5; ultra-low-latency
  autocomplete where +60-100ms is unacceptable.
- AGENT RULE for truffle: hybrid retrieve top-100 → cross-encoder rerank → top-8 into context.
  This single pattern is the highest-leverage retrieval-quality move in 2026.

---

## 3. BM25 vs SEMANTIC vs HYBRID — the honest trade-off
Synthesized from Meili/Typesense/ES hybrid docs + the embedding/rerank sources above.

| Dimension | BM25 / keyword | Dense vector / semantic | Hybrid (both + fusion) |
|---|---|---|---|
| Matches | exact terms, rare words, IDs, codes, names | meaning, paraphrase, synonyms | both |
| Fails on | synonyms, paraphrase, "find X about Y" | exact IDs/SKUs/error-codes, rare tokens, negation | (covers each other's gaps) |
| Out-of-domain | robust (no training) | degrades (embedder didn't see your jargon) | robust |
| Cost | ~free (CPU, inverted index) | embed API + vector storage + ANN compute | both |
| Latency | sub-ms | ms (ANN) | sum of both + fusion |
| Tuning lever | BM25 k1/b, field boosts, synonyms | embedder choice, chunk size, dims | + fusion weight (semanticRatio / RRF k) |
| Cold-start | works day 1 | needs embeddings built | needs embeddings built |

KEY TASTE (the thing juniors get wrong): **semantic search is NOT strictly better than BM25.**
BM25 still WINS for exact-match, rare-term, code/SKU/name lookups, and out-of-domain jargon.
The 2026 consensus is HYBRID (BM25 + vector, fused with RRF) + a reranker on top — because
each leg covers the other's failure mode. "Just use embeddings" is a classic over-correction.

### Fusion methods
- **RRF (Reciprocal Rank Fusion):** `score = Σ 1/(k + rank_i)`, k≈60. Rank-based, no score
  normalization needed → robust, the de-facto default (ES, OpenSearch, hand-rolled Postgres).
- **Weighted/convex (semanticRatio):** Meili's `hybrid.semanticRatio` (0=pure keyword,
  1=pure semantic, 0.5 balanced) — needs comparable score scales; simpler to reason about.
- **Rank Fusion (Typesense):** Typesense auto-fuses keyword + vector when both are in
  `query_by` (see docs file). You don't pick the math; it does it.

---

## 4. The canonical 2026 RAG retrieval pipeline (what truffle should implement)
1. **Chunk** (256-512 tokens, with overlap; chunk quality dominates retrieval quality).
2. **Embed** chunks (default: OpenAI 3-small or Jina v3; long docs: voyage-3-large).
3. **Index** into a hybrid store (Meilisearch/Typesense for turnkey hybrid; or Postgres +
   pg_search BM25 + pgvector for "one fewer service"; or ES/OpenSearch for scale).
4. **Retrieve** stage-1: hybrid (BM25 + vector, RRF) → top ~100. Apply metadata FILTERS here
   (date, tenant, type) — and verify the engine handles filtered-ANN (pgvector ≥0.8!).
5. **Rerank** stage-2: cross-encoder (Cohere rerank-3.5 / Voyage / BGE-reranker) → top ~8.
6. **Generate:** feed top-8 chunks + citations into the LLM.
7. **Index freshness:** writes are async on every engine — re-embed only changed docs
   (embeddings are cached by Meili/Typesense keyed on the template); watch the index-task
   queue, not just query latency.

### Index freshness — the specifics
- **Meilisearch:** every write returns a `taskUid`; poll `/tasks`. Embeddings cached & only
  recomputed for changed docs. Under heavy writes the task queue backlogs (issue #1098).
- **Typesense:** near-real-time; in-memory so writes are fast but RAM-bound; auto-embedding
  recomputes on field change.
- **ES/OpenSearch:** `refresh_interval` (default 1s) controls visibility lag; raise it for
  bulk-load throughput, lower for freshness. `semantic_text` auto-chunks+embeds on ingest.
- **Postgres:** synchronous writes (no queue), but you build/refresh the HNSW index yourself;
  HNSW supports incremental inserts but index build on bulk-load is the slow part.
