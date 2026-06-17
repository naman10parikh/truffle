---
title: "Search Ecosystem — Official Docs Deep-Dive on Load-Bearing Flows (June 2026)"
type: source
created: "2026-06-17"
updated: "2026-06-17"
tags: [search, docs, hybrid-search, faceting, filtering, typo-tolerance, multitenancy, typesense, meilisearch]
summary: "The actual query/config syntax for the load-bearing flows — hybrid search, faceting, filtering, typo tolerance, multi-tenancy — pulled from official docs (Typesense 29 API via context7, Meilisearch hybrid docs via firecrawl). Copy-paste-grade."
researcher: "truffle ECOSYSTEM (CP123 Wave-R)"
---

# Official Docs Deep-Dive — the flows that matter (with real syntax)

> SOURCES: Typesense flows from `/websites/typesense_29_0_api` via context7 (snippets cite
> typesense.org/docs/29.0/api/*). Meilisearch flows from
> https://www.meilisearch.com/docs/capabilities/hybrid_search/getting_started (firecrawl,
> accessed 2026-06-17). These are the exact strings an agent emits.

---

## 1. TYPESENSE — load-bearing flows

### 1a. Hybrid search (keyword + vector in ONE query, auto Rank Fusion)
Put BOTH a text field and the embedding field in `query_by`; Typesense fuses via Rank Fusion.
```
{ "q": "chair", "query_by": "product_name,embedding", "sort_by": "_text_match:desc" }
```
Source: typesense.org/docs/29.0/api/vector-search.md. This is the cleanest hybrid API in the
space — you don't choose the fusion math, Typesense does it. (Contrast Meili's explicit
`semanticRatio` and ES's explicit RRF block.)

### 1b. Hybrid with EXTERNALLY-computed embeddings (you bring the vector)
Use `vector_query` and OMIT the embedding field from `query_by`:
```
POST /multi_search
{ "searches": [ {
  "q": "chair", "query_by": "product_name",
  "vector_query": "embedding:([0.2, 0.4, 0.1])",
  "sort_by": "_text_match:desc" } ] }
```

### 1c. Sort hybrid results by business signal THEN vector distance
```
{ "q":"chair", "query_by":"title,embedding",
  "sort_by":"popularity_score:desc,_vector_distance:asc" }
```
`_vector_distance` and `_text_match` are the two pseudo-fields you sort on. This is how you
inject business ranking (popularity, recency) on top of relevance.

### 1d. Distance threshold (cut off weak semantic matches)
```
{ "q":"chair", "query_by":"embedding,product_name",
  "vector_query":"embedding:([], distance_threshold:0.30)" }
```
Without this, semantic search ALWAYS returns K results even if all are irrelevant — the
classic "semantic search returns garbage for out-of-domain queries" failure. Set a threshold.

### 1e. Multi-tenancy via SCOPED SEARCH KEYS (the killer agent feature)
Source: typesense.org/docs/29.0/api/api-keys.md. You bake a `filter_by` into an HMAC-signed
key so the tenant filter CANNOT be bypassed client-side:
```bash
KEY_WITH_SEARCH_PERMISSIONS="RN23GFr1s6jQ9kgSNg2O7fYcAUXU7127"  # documents:search ONLY
EMBEDDED='{"filter_by":"company_id:124","expires_at":1906054106}'
digest=$(echo -n $EMBEDDED | openssl dgst -sha256 -hmac $KEY_WITH_SEARCH_PERMISSIONS -binary | base64 -w0)
scoped=$(echo -n "${digest}${KEY_WITH_SEARCH_PERMISSIONS:0:4}${EMBEDDED}" | base64 -w0)
```
- Role-based: filter `accessible_to_organization_id:=1 && accessible_to_roles:=[sales,marketing]`.
- Revoking the PARENT key invalidates ALL scoped keys derived from it.
- WHY IT MATTERS for truffle: a multi-tenant agent product MUST isolate tenants. Typesense's
  scoped key = server-enforced tenant filter, no trust in the client. This is the single best
  multi-tenancy primitive of the OSS engines.

### 1f. Typesense feature surface (for the query-builder)
- `filter_by`: `field:value`, `:=` exact, `>`/`<`/`>=`/`<=`, `[min..max]` range,
  `&&`/`||` combine, `:=[a,b]` IN-list. (GET-encode carefully — issue #210; prefer POST.)
- `facet_by`: returns facet counts; `max_facet_values`, facet `sort_by`, facet ranges.
- Typo tolerance: `num_typos` (0-2, per-field), `min_len_1typo`(default 4), `min_len_2typo`(7),
  `typo_tokens_threshold`, `drop_tokens_threshold`.
- `group_by` / `group_limit`; `pinned_hits` / `hidden_hits` (curation); `synonyms` (global in v30).
- Use-cases the docs name: semantic search, recommendations, hybrid, visual image search, RAG.

---

## 2. MEILISEARCH — load-bearing flows

### 2a. Configure an embedder (index setting, done ONCE)
Source: meilisearch.com/docs/capabilities/hybrid_search/getting_started (accessed 2026-06-17).
```bash
PATCH /indexes/kitchenware/settings/embedders
{ "products-openai": {
    "source": "openAi",
    "model": "text-embedding-3-small",
    "apiKey": "OPEN_AI_API_KEY",
    "documentTemplate": "An object used in a kitchen named '{{doc.name}}'" } }
```
- `documentTemplate` uses **Liquid** syntax — it tells Meili WHICH fields to embed and adds
  context. "A good template is short and only includes the most relevant info." This template
  string is a REAL relevance lever (garbage template → garbage embeddings).
- Meili auto-batches docs to the provider, CACHES embeddings, recomputes ONLY changed docs.
- Supported sources (full list from docs): **openAi, cohere, mistral, gemini, cloudflare,
  voyage, jina, AWS bedrock, huggingFace, and a generic `rest` embedder** (any embedding API).
- 2026: can use a DIFFERENT embedder at index-time vs search-time + multimodal (image) embedders.

### 2b. Hybrid search query
```bash
POST /indexes/kitchenware/search
{ "q": "kitchen utensils made of wood",
  "hybrid": { "embedder": "products-openai" } }
```
Meili runs keyword + semantic, merges via its "smart scoring system." Tune the blend with
`hybrid.semanticRatio` (0=pure keyword … 1=pure semantic; 0.5 default-ish). This explicit
ratio is Meili's signature hybrid knob.

### 2c. Meili relevance levers (the ranking-rules pipeline)
Default order: **words → typo → proximity → attribute → sort → exactness**. Fully reorderable
per index (e.g. move `sort` up to make a custom field dominate). This pipeline IS Meili's
relevance model — there's no BM25 k1/b knob; you reorder rules instead.
- Attribute declaration (the #1 footgun — see issues file): `searchableAttributes` (what's
  searched + their priority order), `filterableAttributes` (MUST declare before filtering),
  `sortableAttributes` (MUST declare before sorting), `displayedAttributes` (defaults `["*"]`).
- Typo tolerance on by default; `typoTolerance.minWordSizeForTypos` (oneTypo default 5,
  twoTypos 9), can disable per-attribute.
- Faceting: `facets: ["brand","category"]` in the query (attribute must be filterable).

### 2d. The async-write model (CRITICAL — different from Typesense/Postgres)
EVERY write (add docs, update settings, configure embedder) returns `{ "taskUid": N }`. The
write is QUEUED. You poll `GET /tasks/{uid}` until `status: "succeeded"`. Docs are NOT
searchable until the task finishes. Under heavy writes the queue backlogs (issue #1098). An
agent MUST treat indexing as eventually-consistent and poll task status.

---

## 3. ELASTICSEARCH / OPENSEARCH — load-bearing flows (summary; full crawl in GAPS)
- **Hybrid via RRF** (GA): one `retriever` block with a `standard` (BM25) leg + a `knn`
  (vector) leg fused by `rrf` (rank_constant ~60). This is the explicit-RRF model.
- **`semantic_text` field type**: declare it, ES auto-chunks + embeds on ingest using an
  inference endpoint (ELSER or a 3rd-party embedder). Lowest-effort semantic path in ES.
- **ELSER**: Elastic's own learned SPARSE vector model — semantic search WITHOUT choosing a
  dense embedder; tokens are weighted terms, so it slots into the inverted index. Good when
  you don't want to manage an embedding provider.
- **ES|QL**: piped query language (`FROM idx | WHERE ... | STATS ...`) — far more
  agent-legible than nested Query-DSL JSON. Prefer it for analytics-style agent queries.
- Refresh: `refresh_interval` (default 1s) = the index-freshness knob; raise for bulk-load.

---

## 4. POSTGRES (FTS / pg_search BM25 / pgvector) — load-bearing flows
- **Native FTS:** `to_tsvector('english', body) @@ plainto_tsquery('english', $1)`, rank with
  `ts_rank_cd`, index with `GIN`. NOT true BM25 (no length normalization) — fine for simple
  keyword, weak for relevance ranking.
- **pg_search (ParadeDB) BM25:** `CREATE INDEX ... USING bm25 (...) WITH (key_field='id')`,
  query with the `@@@` operator + `paradedb.score(id)`. Real BM25 (block-weighted, Tantivy).
- **pgvector ANN:** `CREATE INDEX ON items USING hnsw (embedding vector_cosine_ops)`; query
  `ORDER BY embedding <=> $1 LIMIT 10`. **MUST set `SET hnsw.iterative_scan='relaxed_order'`**
  (pgvector ≥0.8) so filtered queries don't under-return (issues file #259). Tune
  `hnsw.ef_search` (higher = better recall, slower).
- **Hybrid in Postgres = DIY:** run pg_search BM25 + pgvector ANN as two CTEs, fuse with RRF
  in SQL (`1.0/(60+rank)`), or use ParadeDB which can do both. No engine fuses for you — this
  is the cost of "one fewer service."
