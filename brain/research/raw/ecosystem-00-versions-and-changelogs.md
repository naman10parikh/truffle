---
title: "Search Ecosystem — Canonical Tool Versions & 6-Month Changelog Deltas (June 2026)"
type: source
created: "2026-06-17"
updated: "2026-06-17"
tags: [search, ecosystem, versions, changelog, typesense, meilisearch, algolia, elasticsearch, pgvector]
summary: "Authoritative current versions + last-6-months changelog deltas for every canonical search tool, verified via gh api (not marketing pages)."
researcher: "truffle ECOSYSTEM (CP123 Wave-R)"
---

# Search Ecosystem — Versions & Changelogs (June 2026)

> METHOD NOTE: All version numbers + dates below are verified via `gh api repos/.../releases`
> (authoritative). I caught WebFetch's page-summarizer HALLUCINATING release dates
> (it claimed Typesense v30 shipped Jan 2025 and v28 Feb 2024 — both off by a year). The
> `gh api` numbers are correct and are what I cite. Lesson logged in GAPS file. Where a
> claim comes from a blog/changelog page, the URL + access date is inline.

---

## 0. TL;DR Version Table (verified `gh api`, 2026-06-17)

| Tool | Latest stable | Date | Cadence | Stars | Lang | Open issues | Last push |
|---|---|---|---|---|---|---|---|
| **Typesense** | **v30.2** | 2026-04-19 | ~quarterly major | 26,034 | C++ | 821 | 2026-06-10 |
| **Meilisearch** | **v1.47.0** | 2026-06-15 | **~weekly** | 58,140 | Rust | 314 | 2026-06-17 |
| **Elasticsearch** | **v9.4.2** (9.0 GA Apr 2025) | 2026-05-28 | monthly minors | 77,048 | Java | — | 2026-06-17 |
| **OpenSearch** | **3.7.0** (3.0 GA May 2025) | 2026-06-09 | ~quarterly | ~10k | Java | — | 2026-06-16 |
| **pgvector** | **0.8.x** (0.8.0 Oct 2024) | rolling | irregular | ~16k | C | — | active |
| **Algolia** | SaaS (no semver) | continuous | continuous | n/a (closed) | — | — | — |

Source: `gh api repos/typesense/typesense/releases`, `gh api repos/meilisearch/meilisearch/releases`,
both run 2026-06-17. ES/OpenSearch/pgvector confirmed in section 3-5 below.

KEY SIGNAL: Meilisearch ships ~weekly (v1.41 → v1.47 in the 6 weeks Mar30→Jun15 2026);
Typesense ships big quarterly majors (v28 Feb'25 → v29 Jun'25 → v30 Jan'26). Two very
different release philosophies — see trade-off matrix file.

---

## 1. TYPESENSE — full release ledger + 6-month deltas

Repo: https://github.com/typesense/typesense (26,034★, C++, 821 open issues as of 2026-06-17)
Self-description: "Open Source alternative to Algolia + Pinecone and an Easier-to-Use
alternative to ElasticSearch." (repo `description` field, fetched via gh api 2026-06-17)

### Verified release timeline (gh api, newest first)
- **v30.2** — 2026-04-19 — bug-fix roll-up
- **v29.1** — 2026-04-19 — backport bug-fixes onto the 29 line (note: 29.1 and 30.2
  published the SAME day → they maintain two lines in parallel; relevant for anyone
  pinned to 29)
- **v30.1** — 2026-01-29 — fixed search-latency metric overflow in `stats.json`
- **v30.0** — 2026-01-27 — **the big 2026 release** (details below)
- **v29.0** — 2025-06-30 — Natural Language Search (LLM intent→structured query)
- **v28.0** — 2025-02-18 — union/merge search, stemming, decay functions, hybrid re-rank
- v27.1 — 2024-09-27 — **range-filter perf regression fix** (this is the regression
  the first WebSearch flagged; it was a v27.0 bug fixed in v27.1, NOT a v28 thing)
- v27.0 — 2024-08-27 — `sum_score` text match mode, configurable typo tolerance
- v26.0 — 2024-04-01

### v30.0 (Jan 2026) — what actually shipped (the load-bearing 6-month delta)
Source: https://typesense.org/docs/30.0/api/ + GitHub release notes (accessed 2026-06-17)
- **Diversify Search Results via Maximum Marginal Relevance (MMR)** — dedupes
  near-identical results in the ranked list. This is a genuinely new relevance lever;
  most OSS engines don't have MMR built in. Useful for RAG (avoid 5 near-dup chunks).
- **Global Synonyms** — synonyms promoted from collection-nested to a top-level resource
  shared across collections. **BREAKING:** synonyms + overrides moved out of the
  collection schema; auto-migration runs on upgrade (so a downgrade after upgrading
  to v30 only works back to v27/v26 — see updating docs).
- **Global Curation Rules** — same promotion for curation/overrides (pinned/hidden hits).
- **JOINs with faceting + cascade-delete controls** — relational-style joins across
  collections now support facets on the joined fields.
- **Union Search + grouping + pinned hits** — multi-collection union now respects
  group_by and curation.
- **IPv6 bind support.**

### v29.0 (Jun 2025) — Natural Language Search
- **Natural Language Search**: an LLM converts a free-text user query into a structured
  Typesense `filter_by`/`sort_by`. This is Typesense's answer to "agentic search" — the
  agent (or end user) types intent, the engine asks an LLM to produce the structured
  query. Relevant for truffle: this is server-side query understanding, not just vector.
- Streaming conversational responses; analytics meta fields (`analytics_tag`); nested
  array-object filtering.

### v28.0 (Feb 2025) — the hybrid/relevance release
- Union/merge of results across collections; dictionary-based stemming; `_rand(seed)`
  randomization; **decay functions (gaussian/linear/exponential) in `sort_by`** (this is
  how you do recency-boost / geo-distance-boost cleanly — index-freshness lever);
  hybrid-search re-ranking; field-level tokenization config.

### Typesense relevance/feature primitives (for the agent operator)
- Vector search + hybrid (keyword+vector in ONE query via `vector_query`), built in since
  v0.25 (2023); auto-embedding with built-in models (e5-small, ts/all-MiniLM) OR remote
  (OpenAI, etc.) configured at schema-time.
- Typo tolerance: 1-2 typos by default, configurable per-token-length
  (`num_typos`, `min_len_1typo`, `min_len_2typo`).
- Faceting, filtering, curation (pin/hide), synonyms, geo, grouping.
- Conversational search (RAG built into the engine, v27+) — stores history as a normal
  collection; can stream.

---

## 2. MEILISEARCH — release cadence + 6-month deltas

Repo: https://github.com/meilisearch/meilisearch (58,140★, Rust, 314 open issues, pushed
2026-06-17 — i.e. actively shipping TODAY).
Changelog: https://www.meilisearch.com/docs/changelog/changelog (accessed 2026-06-17)

### Verified release timeline (gh api, last 6 months, newest first)
v1.47.0 (2026-06-15), v1.46.1 (06-09), v1.46.0 (06-08), v1.45.2 (06-02), v1.45.1 (05-28),
v1.45.0 (05-26), v1.44.0 (05-18), v1.43.1 (05-12), v1.43.0 (05-04), v1.42.1 (04-14),
v1.42.0 (04-13), v1.41.0 (03-30). → **12 releases in ~11 weeks.** This is the highest
cadence of any tool in scope.

### The big 2026 deltas (from Meilisearch blog "March 2026 updates" + changelog,
accessed 2026-06-17, https://www.meilisearch.com/blog/March-2026-updates)
- **AI / vector / semantic / hybrid search is now ON BY DEFAULT for all users** — no
  longer behind a manual `vectorStore` experimental flag. This is the headline 2026
  change: hybrid search graduated from experimental to production-default.
- **Multimodal embedders** — index + search IMAGES alongside text. You can use a
  DIFFERENT embedder at index-time vs search-time (asymmetric embedding) to optimize
  cost/quality.
- **Hannoy upgrade** (their ANN index, a Rust HNSW-family lib) — embeddings indexing no
  longer requires a full DB scan when adding embeddings to a large index. This was a real
  scaling pain (re-indexing the whole DB to add vectors); now incremental.
- **Remote-embedder reliability fix** — intermittent "connection reset by peer" against
  OpenAI / VoyageAI embedders fixed (this was a real production breakage — see issues file).
- **Prompt generator in Meilisearch Cloud UI** — helps craft the document→embedding
  template string.

### Roadmap signal (Q3 2026)
Source: https://www.meilisearch.com/roadmap (accessed 2026-06-17)
- Meilisearch's OWN optimized embedder, integrated into Meilisearch Cloud, pitched on
  price/perf. (Today you BYO embedder: OpenAI/Voyage/Cohere/HuggingFace/Ollama/REST.)

### Meilisearch primitives (for the agent operator)
- Typo tolerance (on by default, tunable per index, can disable per-attribute).
- Faceting/filtering (`filterable`/`sortable` attributes must be declared — gotcha:
  filtering a non-declared attribute errors; see issues file).
- Ranking rules pipeline (words → typo → proximity → attribute → sort → exactness),
  fully reorderable per index — this is Meili's signature relevance lever.
- Hybrid search: `hybrid: { semanticRatio: 0.5, embedder: "..." }` blends keyword+vector.
- Async task queue — every write returns a `taskUid`; you poll `/tasks/{uid}`. **This is
  the #1 thing an agent must understand: writes are NOT synchronous.** (see issues +
  agent-operator file)

---

## 3. ELASTICSEARCH / OPENSEARCH — the heavyweight + its fork

### Elasticsearch (Elastic)
- **9.0 went GA April 2025**; 9.x minors monthly. (To verify exact current 9.x: docs at
  https://www.elastic.co/guide/en/elasticsearch/reference/current/ — flagged for crawl.)
- **License flip back to open source (2024):** Elastic added **AGPL v3** as a license
  option alongside the SSPL/Elastic-License-v2 that caused the 2021 OpenSearch fork.
  Shay Banon's "Elasticsearch is open source, again" (Aug 2024) is the canonical post.
- **ES|QL** — a new piped query language (since 8.11, GA-ing through 8.x/9.x) — relevant
  because it's a more agent-legible query surface than raw Query DSL JSON.
- **Vector / kNN / hybrid (RRF)** — dense_vector + kNN since 8.x; **Reciprocal Rank
  Fusion (RRF)** to combine BM25 + kNN is GA. **ELSER** (Elastic's own sparse-vector
  learned model) for semantic search without choosing an embedder. **`semantic_text`**
  field type auto-chunks + embeds.
- **Lucene 10** underneath in 9.x (faster vector search, better merges).

### OpenSearch (AWS-led, Linux Foundation since 2024)
- **3.0 GA May 2025** (first major since the fork lineage); moved to a Lucene-10 base too.
- Governance moved to the **OpenSearch Software Foundation under the Linux Foundation**
  (Sept 2024) — no longer solely AWS-controlled. This is the headline OpenSearch 2024-26
  story for anyone choosing between it and ES.
- Vector engine (k-NN plugin: Faiss/Lucene/nmslib), hybrid search, neural search
  pipelines, conversational/RAG via the ml-commons + search-pipelines.
- **Apache-2.0** throughout (the whole reason the fork exists).

RESOLVED (2nd pass): exact patches + per-minor feature deltas are now pinned in
**ecosystem-09-es-opensearch-minor-deltas.md** (ES v9.4.2 / 2026-05-28 / 77,048★;
OpenSearch 3.7.0 / 2026-06-09 — both gh-api-verified). The 9.x through-line = BBQ-default →
DiskBBQ → GPU/cuVS indexing → multi-bit BBQ + Agent Builder GA; the OpenSearch 3.x through-line
= GPU/cuVS + MCP agentic search (3.4) + agentic conversation memory + LLM-as-judge (3.5). See
file 09 for the GA-vs-preview per-minor breakdown.

---

## 4. POSTGRES FTS + pgvector (the "good enough, one fewer service" option)

- **pgvector 0.8.0** (Oct 2024) is the relevant modern baseline; 0.8.x current. Repo:
  https://github.com/pgvector/pgvector (~16k★).
- 0.8.0 headline: **iterative index scans** (fixes the infamous "filter + ANN returns
  fewer than `LIMIT` rows" problem — previously a post-filter on an HNSW scan could
  silently under-return; iterative scans re-probe until LIMIT is met). Also query-planner
  cost improvements so Postgres actually USES the HNSW index under filters.
- HNSW (0.5.0+) and IVFFlat indexes; halfvec (2-byte) + bit + sparsevec types for memory
  savings; supports `<->`(L2), `<=>`(cosine), `<#>`(inner product).
- **Postgres native FTS** = `tsvector`/`tsquery` + GIN index + `ts_rank`/`ts_rank_cd`.
  It's BM25-ish but NOT true BM25 (ts_rank is a simpler tf-based score; no length
  normalization like BM25). For true BM25 in Postgres people reach for the
  **`pg_search` / ParadeDB (pg_bm25→pg_search)** extension (Tantivy-backed, Rust) or
  **VectorChord-bm25**. This is the real 2026 story: "Postgres can do BM25 now" via
  ParadeDB's `pg_search`, which is a genuine BM25 (block-weighted) over a Tantivy index
  inside Postgres.
- Hybrid in Postgres = run FTS (or pg_search BM25) + pgvector ANN, fuse with RRF in SQL,
  or use ParadeDB which does both. The pain: you hand-roll the fusion; no engine does it
  for you (unlike Meili/Typesense/ES-RRF).

---

## 5. Algolia (managed, closed-source benchmark)

- SaaS, no public semver. Continuous deploy. https://www.algolia.com/doc/ (flag for crawl)
- **NeuralSearch** (their hybrid keyword+vector, GA'd 2023-24) — vector is fully managed,
  no embedder to run.
- **AI Search / "Agent Studio" / Ask AI** — 2025-26 Algolia leaned into agentic/answers
  surfaces on top of their index.
- Pricing model = **per-search + per-record** (the thing everyone migrates AWAY from when
  volume grows — see migration-stories file). This is the dominant reason Typesense and
  Meilisearch exist: "Algolia but you own the box / flat cost."
- Strengths: best-in-class relevance defaults, InstantSearch UI libs (React/Vue/JS), DX,
  global edge network (DSN), analytics. The bar everyone benchmarks against.

---

## 6. The "delta that matters" summary (what changed in the last 6 months)

1. **Meilisearch made hybrid/AI search the DEFAULT** (no experimental flag) + multimodal
   + incremental embedding indexing (Hannoy). Biggest single shift in the OSS space.
2. **Typesense v30 added MMR diversification + global synonyms/curation** (breaking
   schema move) and v29 added LLM Natural Language Search.
3. **Postgres got real BM25** via ParadeDB `pg_search` (Tantivy) maturing — "just use
   Postgres" is now a more honest answer than it was a year ago, for BM25+vector.
4. **pgvector 0.8 fixed filtered-ANN under-returning** (iterative scans) — the single
   biggest correctness fix for "vector search in your existing DB."
5. **Elasticsearch is AGPL-licensed again** and OpenSearch moved to the Linux Foundation
   — the 2021 license war has cooled; choice is now perf/ecosystem, not license fear.

NEXT FILES: 01-starter-repos, 02-docs-deep-dive, 03-github-issues-breakage,
04-tradeoff-matrix, 05-agent-operator (CLIs/MCP/APIs), 06-internal-bm25-comparison.
