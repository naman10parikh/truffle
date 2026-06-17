---
title: "truffle TOOL-MATRIX — canonical search tools, default vs alts, agent-access surface, required secrets"
type: synthesis
domain: search
created: 2026-06-17
updated: 2026-06-17
tags: [tool-matrix, typesense, meilisearch, elasticsearch, opensearch, pgvector, paradedb, algolia, embeddings, reranking, mcp, secrets, truffle, cp123]
sources: ["brain/research/raw/ecosystem-06-tradeoff-matrix.md", "brain/research/raw/ecosystem-05-agent-operator-clis-mcps.md", "brain/research/raw/ecosystem-00-versions-and-changelogs.md", "brain/research/raw/ecosystem-04-embeddings-reranking-rag.md", "brain/research/raw/ecosystem-02-docs-deep-dive-flows.md", "brain/research/raw/ecosystem-01-starter-repos.md", "brain/research/raw/ecosystem-09-es-opensearch-minor-deltas.md", "brain/research/raw/ecosystem-07-internal-bm25-vs-real-search.md"]
related: ["[[truffle EXPERTISE-MAP]]", "[[truffle OPINIONS]]", "[[truffle KNOWN-PITFALLS]]", "[[truffle GAPS-AND-DISPUTES]]"]
summary: "The canonical tool per search category — DEFAULT vs alternatives, when-to-use-which, the agent-access surface (CLI/API/MCP), and the env vars/secrets each needs. The secrets column feeds the Required-Secrets manifest in Wave P. Decisions, not feature tables — every alt names the honest cost. Versions gh-api-verified 2026-06-17."
---

# truffle TOOL-MATRIX

> Per category: the **DEFAULT**, the **alternatives** (with the honest cost the marketing hides), the **agent
> surface** (can a headless truffle agent drive it — CLI/API/MCP?), and the **secrets** it needs. The secrets
> column is the source for the Wave-P **Required-Secrets manifest**. Secret names follow the repo's
> `.env.example` conventions (`<VENDOR>_<PURPOSE>`). For the full decision logic see [[truffle OPINIONS]]; for
> gotchas per tool see [[truffle KNOWN-PITFALLS]]. Versions/stars are gh-api-verified 2026-06-17.

---

## Category 1 — Search engine (the core retrieval substrate)

**DEFAULT: Meilisearch** for the turnkey/agent-native path. Easiest self-host, best DX, hybrid/AI search ON BY
DEFAULT (2026), official MCP + official CLI, ~weekly releases (v1.47.0, 58,140★, Rust). The agent-tooling +
DX is the edge. Source: `ecosystem-06` §3; `ecosystem-00` §2; `ecosystem-05` §6.

| Tool | Pick when | Honest cost / limit | Agent surface | Latest (gh-api) |
|---|---|---|---|---|
| **Meilisearch** ★default | turnkey hybrid, best DX, agent-native (MCP+CLI), docs/content search, MVPs | **async writes** (poll `/tasks`); deploy RAM spike storing vectors (#5616); default matching can drop typo'd multi-word hits (#4093); attribute-declaration footguns; storage/vector internals churn across minors | **MCP** (`meilisearch/meilisearch-mcp`, official) + **official CLI** + REST `:7700` | v1.47.0 (2026-06-15) |
| **Typesense** | fastest latency + best multi-tenancy (HMAC scoped keys) + cleanest hybrid API; latency-critical/instant-search UX | whole index (incl. vectors) in RAM → OOM on big exports (#1067); HA Raft cluster fiddly (#465/#2208); **no official MCP/CLI**; v28 silently regressed typo tolerance (#2313) | REST `:8108` + `/multi_search`; **community-only MCP/CLI** (GAP) | v30.2 (2026-04-19) |
| **Postgres + pg_search + pgvector** | app ALREADY runs Postgres, "one fewer service", agent drives via SQL | you hand-roll RRF fusion in SQL; HNSW dims ≤2000/4000 (#461); pg_search young (no Prisma #1100, weak non-latin #3782, JOIN perf maturing); filtered-ANN needs ≥0.8 + iterative scans (#259) | **`psql`/SQL** (most agent-legible) + `crystaldba/postgres-mcp` | pgvector 0.8.x; ParadeDB v0.24 |
| **Algolia** | relevance is revenue-critical (e-commerce), zero ops, budget > eng time | **per-query + per-record cost** (worst fit for high-volume agent querying); vendor lock-in; you don't own the box | **2 hosted MCPs** (Public + Productivity) + official CLI + InstantSearch | SaaS (no semver) |
| **Elasticsearch** | petabyte scale, logs+search-in-one, heavy aggregations | ops-heavy (JVM, shards, the 10-issue catalog); mapping-explosion risk; deep-pagination 10K ceiling | **MCP** (`elastic/mcp-server-elasticsearch`) + REST/ES\|QL | v9.4.2 (2026-05-28) |
| **OpenSearch** | same as ES + want Apache-2 + open (LF) governance + most agent-native posture | hybrid/RRF correctness bugs as late as 3.5 (eval your version); same JVM ops weight | **MCP** (`opensearch-project/opensearch-mcp-server-py`) + REST/gRPC | 3.7.0 (2026-06-09) |

- **Agent surface detail (Meilisearch):** REST `Authorization: Bearer <key>` on `:7700`; **ASYNC writes →
  `taskUid` → poll `GET /tasks/{uid}`** (the #1 agent rule); master key vs tenant tokens (JWT) for
  multi-tenancy; embedders configured per-index (`PATCH /indexes/<idx>/settings/embedders`). Source:
  `ecosystem-05` §3; `ecosystem-02` §2a.
- **Agent surface detail (Typesense):** `X-TYPESENSE-API-KEY` header on `:8108`; `/multi_search` batches N
  queries in ONE request; **HMAC scoped keys** bake a `filter_by` for server-enforced tenant isolation;
  synchronous-ish writes but returns `HTTP 503 Lagging or Not Ready` under heavy bulk ingest (retry+backoff).
  Source: `ecosystem-05` §3; `ecosystem-02` §1e; `field-02` §3.
- **Agent surface detail (Postgres):** SQL over libpq; synchronous writes; the agent BUILDS/refreshes the HNSW
  index itself (`CREATE INDEX ... USING hnsw (embedding vector_cosine_ops)`); **MUST `SET
  hnsw.iterative_scan='relaxed_order'`** (≥0.8) so filtered queries don't under-return. Source: `ecosystem-02`
  §4; `ecosystem-05` §3.
- **Secrets:** `MEILI_MASTER_KEY` (+ `MEILI_URL`) · `TYPESENSE_API_KEY` (+ `TYPESENSE_HOST`, `TYPESENSE_PORT`) ·
  `DATABASE_URL` / `PGVECTOR_URL` (the pgvector DB — **acorn-owned substrate**; truffle consumes the
  connection, acorn provisions it) · `ALGOLIA_APP_ID` + `ALGOLIA_ADMIN_API_KEY` + `ALGOLIA_SEARCH_API_KEY` ·
  `ELASTICSEARCH_URL` + `ELASTICSEARCH_API_KEY` · `OPENSEARCH_URL` + `OPENSEARCH_USERNAME`/`OPENSEARCH_PASSWORD`.
- **Pitfalls:** P1 (Meili async writes), P2 (attribute declaration), P5 (Typesense RAM/in-memory), P6 (Typesense
  HA Raft), P14 (Typesense v28 typo regression), P15 (Meili internals churn). See [[truffle KNOWN-PITFALLS]].

## Category 2 — Embedding model (the vector signal for hybrid/semantic)

**DEFAULT: OpenAI `text-embedding-3-small`** as the safe most-integrated baseline; **Jina v3** for best
price/quality; **voyage-3-large** for long-context/quality-critical. **STORAGE of the vectors is acorn's
pgvector; the MODEL choice for retrieval quality is truffle's.** Source: `ecosystem-04` §1; mission boundary.

| Model | Pick when | Dims · $/1M · MTEB | Honest cost / limit |
|---|---|---|---|
| **OpenAI text-embedding-3-small** ★default | most apps; every vector DB supports it OOTB | 1,536 · $0.02 · 62.3 | "good enough for 90%"; closed |
| **Jina v3** ★price/quality | best $/quality; want open-weight self-host option | 1,024 · $0.02 · 65.5 | the sleeper pick; beats OpenAI-large at 1/6 cost |
| **voyage-3-large** ★quality+long-ctx | quality-critical; whole-paper-in-one-call (32K ctx) | 1,024 · $0.18 · 67.1 | premium (but ~$90/1M docs — negligible at scale) |
| **OpenAI text-embedding-3-large** | max OpenAI quality | 3,072 · $0.13 · 64.6 | **3,072 dims CAN'T be HNSW-indexed** unless Matryoshka-truncated (#461) |
| **Cohere embed-v4** | strong + asymmetric (search_document/query) | 1,024 · $0.10 · 66.3 | **512-token cap** |
| **Google text-embedding-004** | already on Google; free tier | 768 · free/$0.025 · 63.0 | 2,048 ctx |
| **GTE-large / nomic-v1.5 / BGE-large (OSS)** | self-host; compliance/residency reason | 768–1,024 · free · 62–65 | break-even vs API ≈ 10-15M emb/mo |

- **truffle rules:** MTEB is a SHORTLIST generator, not a decision oracle — eval candidates on YOUR 200-query
  golden set (an MTEB-#11 model beat the top-3 on a real legal corpus); a 5-pt MTEB gap ≈ 3-8% real recall.
  **Dims drive your vector-DB bill** (1024-dim float32 = 4KB/vector → 10M = 40GB). Use Matryoshka truncation
  (`dimensions` param) to fit the HNSW cap. Closed-vs-open is a COMPLIANCE decision in 2026, not a quality one.
  Source: `field-04` §2; `ecosystem-04` §1.
- **Secrets:** `OPENAI_API_KEY` · `JINA_API_KEY` · `VOYAGE_API_KEY` · `COHERE_API_KEY` · `GOOGLE_API_KEY` ·
  (OSS self-host: none — model weights local). The embedder API key is also configured INSIDE the engine
  (Meili `settings/embedders` `apiKey`; Typesense schema-time remote embedder).
- **Pitfalls:** P8 (dims > index cap), P9 (MTEB-by-leaderboard), P10 (asymmetric embedding mismatch). See
  [[truffle KNOWN-PITFALLS]].

## Category 3 — Reranker (the stage-2 cross-encoder, the biggest single quality lever)

**DEFAULT: Cohere rerank-3.5** as the managed drop-in (pick it for the SLA/managed infra, not because it wins
quality); **bge-reranker-large v2 if you can batch on GPU** (matches API latency at zero marginal cost). Source:
`ecosystem-04` §2; `field-04` §3.

| Reranker | Pick when | Type · NDCG@10 · latency · $/1M | Honest cost / limit |
|---|---|---|---|
| **Cohere rerank-3.5** ★default (managed) | want reliability/SLA, easy API drop-in, multilingual | cross-enc · strong · ~100ms · API | within noise of open bge-large on quality; closed; per-call cost |
| **bge-reranker-large v2** ★default (self-host) | can batch on GPU; want zero marginal cost | cross-enc · 0.715 · 92ms (base) · $0.18-0.35 | the standard self-hosted reranker; needs GPU to be fast |
| **Voyage rerank-2** | instruction-following / agent/conversational | cross-enc · strong · — · API | closed |
| **Jina reranker v2** | open-weight + multimodal (images/PDFs) | cross-enc · — · 110ms · OSS | open |
| **ZeroEntropy zerank-1** | calibrated scores, 100+ languages, cheap | cross-enc · 0.85+ (own bench) · ~60ms · $0.025 | "+18% vs Cohere" is a VENDOR bench — flagged |
| **MiniLM (cross-enc)** | tightest latency budget | cross-enc · lower · 55ms · $0.08 | smaller/cheaper, lower quality |

- **truffle rules:** if you can do ONE thing to a hybrid pipeline, add a reranker (+5-15 NDCG@10 pts,
  +20-35% RAG accuracy, 72% LLM-cost reduction). **But know when NOT to:** skip it when latency can't absorb
  +100-500ms (autocomplete) or when bi-encoder MRR@5 already > 0.85. The pattern: hybrid retrieve top-100 →
  rerank → top-8. Source: `ecosystem-04` §2; `field-04` §3.
- **Secrets:** `COHERE_API_KEY` · `VOYAGE_API_KEY` · `JINA_API_KEY` · `ZEROENTROPY_API_KEY` · (self-host bge:
  none — weights local + a GPU).
- **Pitfalls:** P11 (reranking a near-perfect set is wasted latency), P12 (reranker vendor benchmarks). See
  [[truffle KNOWN-PITFALLS]] / S6.

## Category 4 — Fusion method (how BM25 + vector legs combine)

**DEFAULT: RRF as the robust starting point, then TUNE tiered boosting on top** (RRF is the floor, not the
finish). Engine-dependent. Source: `ecosystem-04` §3; `field-01` §2.

| Method | What | Pick when | Where |
|---|---|---|---|
| **RRF (Reciprocal Rank Fusion)** ★default-floor | `Σ 1/(k+rank)`, k≈60; rank-based, no score normalization | robust default; "good enough for RAG grounding" | ES/OpenSearch `rrf` retriever; hand-rolled Postgres SQL |
| **Tuned tiered boosting** ★the real lift | boost all-term-match 100×, any-term 10×, vector fallback 0.1× | relevance is revenue-critical (+7.5% vs RRF's +1.3% on WANDS) | DIY on any engine |
| **Weighted/convex (`semanticRatio`)** | explicit 0→1 keyword↔semantic blend | want a simple knob; comparable score scales | Meilisearch `hybrid.semanticRatio` |
| **Auto Rank Fusion** | engine fuses keyword+vector when both in `query_by` | want zero fusion config | Typesense (`query_by: "text,embedding"`) |

- **truffle rule:** ship RRF, then measure on your golden set and tune the tiers if relevance is
  revenue-critical. Don't stop at RRF and call it done. Source: `field-01` §2/§4 (Dispute B).
- **Secrets:** none (fusion is query-side config / SQL).
- **Pitfalls:** P13 (RRF-is-the-finish-line over-correction). See [[truffle KNOWN-PITFALLS]] / S3.

## Category 5 — Faceting / filtering (the systems-problem layer)

**DEFAULT: the engine's native faceting** with the scale dials applied (cardinality reduction, count caps,
`terminate_after`, sampling). Source: `field-02`; `ecosystem-02`.

| Lever | What | Pick when | Where |
|---|---|---|---|
| **Cardinality reduction** ★ | curate facet field to fewer values (Vinted 2M→40K = ~15ms P99) | high-cardinality facet field is a latency tax | any engine (data modeling) |
| **Count cap ("500+")** ★ | don't compute exact counts past N | exact high counts are expensive + users don't care | any engine (app logic) |
| **Facet sampling** | estimate counts from a % of hits | facets over 100K+ matched docs | Typesense `facet_sample_threshold`/`_percent` |
| **`terminate_after` / `size:0`** | cap docs scanned per shard; aggregation-only requests | ES high-cardinality terms aggs | Elasticsearch/OpenSearch |
| **Multi-select exclusion query** | per-facet query excluding only that facet's own filter | showing unselected-option counts | any faceted UI |

- **truffle rules:** declare filterable/sortable attributes explicitly (never trust defaults); faceting is a
  CPU-vs-latency-vs-disk-vs-cache-vs-correctness tradeoff, not "GROUP BY + COUNT"; row stores (Postgres) are
  structurally worse at faceting than inverted-index/columnar engines. Source: `field-02` §1/§2; `ecosystem-02`
  §2c.
- **Secrets:** none (query-side config).
- **Pitfalls:** P7 (faceting is a systems problem), P2 (undeclared attributes silently don't facet). See
  [[truffle KNOWN-PITFALLS]] / S5.

## Category 6 — Agent control surface (MCP / CLI / API)

**DEFAULT: drive via the official MCP where one exists; Postgres via `psql`/SQL.** Source: `ecosystem-05`
§1/§2.

| Engine | MCP | CLI | Verdict |
|---|---|---|---|
| **Meilisearch** | `meilisearch/meilisearch-mcp` (official, 192★) | official `meilisearch-cli` | **USE — most agent-native OSS engine** |
| **Elasticsearch** | `elastic/mcp-server-elasticsearch` (official, 674★) | clients/`eland`/Kibana Dev Console | USE |
| **OpenSearch** | `opensearch-project/opensearch-mcp-server-py` (official, 132★) | `opensearch-cli` + clients | USE |
| **Algolia** | 2 hosted MCPs (Public + Productivity) | official Algolia CLI + InstantSearch | USE if on Algolia |
| **Postgres (pgvector)** | `crystaldba/postgres-mcp` ("Postgres MCP Pro", 2,918★, community-serious) | **`psql`** (it's just SQL!) | USE — most agent-legible surface of all |
| **Typesense** | `avarant/typesense-mcp-server` (8★) / `akshitkrnagpal/typesensekit` (community) | community only (`AlexBV117/typesense-cli`) | **GAP — no official MCP/CLI** (truffle could build one) |

- **truffle play:** the cleanest agent control surfaces are (a) Postgres = `psql` + SQL (no new API to
  learn), (b) Meilisearch = official CLI + simple REST + official MCP, (c) Algolia = official CLI + 2 MCPs.
  Typesense is REST-only-in-practice for automation → the OSS contribution opportunity. Source: `ecosystem-05`
  §2/§6.
- **Secrets:** reuse the engine secrets from Category 1 (the MCP/CLI authenticate with the same keys).
- **Pitfalls:** P3 (Typesense no official MCP), P1 (Meili async — MCP writes still queue). See
  [[truffle KNOWN-PITFALLS]].

## Category 7 — Reference repos to clone/read (not a runtime dependency)

Read these to become dangerous; they're knowledge, not infra. Source: `ecosystem-01`.

| Repo | Use | Caveat |
|---|---|---|
| **`paradedb/paradedb`** (8,938★, pushed daily) | BM25-in-Postgres + hybrid-in-SQL reference | young: ORM/non-latin/JOIN edges |
| **`oramasearch/orama`** (10,413★) | full-text+vector+hybrid in a tiny embeddable JS lib (edge/in-process) | pushed Feb 2026 — verify still active |
| **`theaiautomators/claude-code-agentic-rag-masterclass`** (173★) | **the repo matching truffle's identity** — agent-built RAG, Claude-Code-native | read for HOW, not WHAT |
| **`RustyRAG/RustyRAG`** | clean readable HNSW-dense + BM25-sparse + fusion reference | small, recent |
| **`typesense-instantsearch-adapter`** (518★) | rich UI on Typesense by borrowing Algolia's widgets | official |
| **`bfritscher/typesense-dashboard`** (645★) | de-facto Typesense admin UI | community |
| **`Blazity/enterprise-commerce`** (690★) | REAL Next.js + Meilisearch storefront (faceting in anger) | maintained |
| **`open-wanderer/wanderer`** (3,675★) | real app using Meili end-to-end | maintained |
| **in-house BM25** (`memory-search.sh`, `sentinel/brain_search.py`, `llmwiki/bm25.ts`) | the baseline truffle supersedes (good ONLY for tiny offline corpora) | not a product engine (no index/facets/typo/vector/multitenancy) |

- **No secrets** (these are clones/reads).

---

## The Required-Secrets manifest (Wave-P input — consolidated)

> Minimal set a truffle deployment needs, by what's actually wired. Names follow `.env.example` conventions.
> Inherited platform secrets (`ANTHROPIC_API_KEY`, `GITHUB_PERSONAL_ACCESS_TOKEN`, `FIRECRAWL_API_KEY`) are
> already in `.env.example` — reuse, don't redefine.

| Secret | Tool / purpose | Tier | Notes |
|---|---|---|---|
| `ANTHROPIC_API_KEY` | the agent itself + LLM query-understanding / NL-search | **required** | already in `.env.example` |
| `MEILI_MASTER_KEY` (+ `MEILI_URL`) | Meilisearch (default engine) — REST + CLI + MCP | **required (default engine)** | tenant tokens (JWT) derive from master for multi-tenancy |
| `TYPESENSE_API_KEY` (+ `TYPESENSE_HOST`/`PORT`) | Typesense — REST + scoped keys | optional (if Typesense) | revoking parent key invalidates all scoped keys (S7) |
| `DATABASE_URL` / `PGVECTOR_URL` | Postgres + pg_search + pgvector — **acorn-owned DB**, truffle consumes | optional ("one fewer service") | acorn provisions; truffle owns retrieval/index settings |
| `OPENAI_API_KEY` | default embedder (3-small) + reranker fallback | **required (default embedder)** | also set INSIDE the engine's embedder config |
| `JINA_API_KEY` | Jina v3 embedder (best price/quality) / Jina reranker | optional | open-weight self-host avoids this |
| `VOYAGE_API_KEY` | voyage-3-large embedder (long-ctx) / Voyage rerank | optional | quality-critical / 32K-ctx path |
| `COHERE_API_KEY` | Cohere embed-v4 / rerank-3.5 (default managed reranker) | optional (default reranker) | picked for SLA, not quality |
| `ALGOLIA_APP_ID` / `ALGOLIA_ADMIN_API_KEY` / `ALGOLIA_SEARCH_API_KEY` | Algolia (managed engine) — REST + CLI + 2 MCPs | optional (if Algolia) | cost-aware: per-query + per-record billing (S2) |
| `ELASTICSEARCH_URL` / `ELASTICSEARCH_API_KEY` | Elasticsearch (scale) — REST/ES\|QL + MCP | optional (at scale) | AGPL again; BBQ default in 9.x |
| `OPENSEARCH_URL` / `OPENSEARCH_USERNAME` / `OPENSEARCH_PASSWORD` | OpenSearch (scale + open governance) — REST/gRPC + MCP | optional (at scale) | Apache-2 + LF-governed |
| `ZEROENTROPY_API_KEY` | ZeroEntropy reranker | optional | vendor-bench claims flagged |
| `GOOGLE_API_KEY` | Google text-embedding-004 (free tier) | optional | if already on Google |

- **The agent-operator hygiene the manifest implies (carry into Wave P):** treat Meilisearch writes as async
  (poll `/tasks`); verify pgvector ≥0.8 + iterative scans before relying on filtered-ANN; keep embedding dims
  ≤ the index cap (Matryoshka-truncate if needed); budget RAM = index × ~1.5 for in-memory engines and test
  the deploy spike; be cost-aware on Algolia (batch, partial-update); store all secrets out of logs + URL
  query strings; the pgvector DB connection is acorn's substrate — don't re-provision it.

## The meta-decision (truffle's spine, restated as tool choices)

1. **Turnkey/agent-native → Meilisearch** (official MCP+CLI, hybrid default-on). Typesense if
   latency/multi-tenancy dominate. Postgres+pgvector (acorn's DB) for "one fewer service". Algolia only when
   relevance is revenue-critical + budget > eng time. ES/OpenSearch only at petabyte scale. (O1, O6)
2. **Hybrid (BM25 + vector + RRF) + a reranker is the 2026 default** — pure vector lost; RRF is the floor,
   tune the tiers; the reranker is the biggest single lever. (O2, O3, O4)
3. **MTEB is a prior not an oracle; eval on YOUR golden set; search is never done.** (O5, O8)
4. **Drive via MCP first; Postgres via SQL; treat writes as async; never treat a version bump as a no-op.**
   (O9, O10)
