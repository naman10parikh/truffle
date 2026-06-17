---
title: "truffle EXPERTISE-MAP — what the Search / retrieval / relevance employee must master"
type: synthesis
domain: search
created: 2026-06-17
updated: 2026-06-17
tags: [expertise-map, search, retrieval, relevance, hybrid-search, bm25, vector, reranking, faceting, typo-tolerance, jtbd, truffle, cp123]
sources: ["brain/research/raw/ecosystem-00-versions-and-changelogs.md", "brain/research/raw/ecosystem-01-starter-repos.md", "brain/research/raw/ecosystem-02-docs-deep-dive-flows.md", "brain/research/raw/ecosystem-03-github-issues-real-breakage.md", "brain/research/raw/ecosystem-04-embeddings-reranking-rag.md", "brain/research/raw/ecosystem-05-agent-operator-clis-mcps.md", "brain/research/raw/ecosystem-06-tradeoff-matrix.md", "brain/research/raw/ecosystem-07-internal-bm25-vs-real-search.md", "brain/research/raw/ecosystem-09-es-opensearch-minor-deltas.md", "brain/research/raw/field-01-hybrid-beats-vector-and-relevance-hell.md", "brain/research/raw/field-02-faceting-at-scale-and-migration-war-stories.md", "brain/research/raw/field-04-explicit-taste-from-great-practitioners.md"]
related: ["[[truffle BATTLE-TESTED-SCENARIOS]]", "[[truffle KNOWN-PITFALLS]]", "[[truffle OPINIONS]]", "[[truffle GAPS-AND-DISPUTES]]", "[[truffle TOOL-MATRIX]]"]
summary: "The structured map of everything the Search / retrieval / relevance employee must master, organized by job-to-be-done (not by engine/vendor), each node cited to a raw source. A fresh Claude session reading brain/ should be able to route any search task and know what 'good' looks like at June-2026 SOTA."
---

# truffle EXPERTISE-MAP

> Organized by **job-to-be-done**, not by engine. A fresh Claude session reading `brain/` should be able to
> route any search / retrieval / relevance task to the right node and know what "good" looks like. Every node
> cites its raw source. Companion files: scenarios → [[truffle BATTLE-TESTED-SCENARIOS]]; gotchas →
> [[truffle KNOWN-PITFALLS]]; taste → [[truffle OPINIONS]]; unknowns → [[truffle GAPS-AND-DISPUTES]]; tools →
> [[truffle TOOL-MATRIX]].

## The boundary truffle holds first (search/relevance vs everything adjacent) — place EVERY task here first

truffle owns **search, retrieval, and relevance ranking** — the layer that takes a query and returns the
right ordered results. It does NOT own the vector STORAGE substrate when that substrate is a database another
employee owns, and it does NOT own the LLM generation step that consumes retrieved chunks.

- **Keep in truffle** when the task is: *pick/operate a search engine (Typesense/Meilisearch/Elasticsearch/
  OpenSearch/Algolia) · design a hybrid (BM25 + vector) query + fusion · tune relevance (boosts, synonyms,
  ranking rules, tiered fusion) · faceting + filtering + typo-tolerance + curation · choose an embedding model
  for retrieval quality · add a reranker · build the golden-query eval + version-bump regression loop · the
  retrieve→rerank RAG retrieval pipeline.* Source: `ecosystem-06` §3; `ecosystem-04` §4; `field-01` §3.
- **Cite acorn's boundary (don't duplicate it)** when the task is "where do the embedding VECTORS physically
  live / the Postgres + pgvector DB ownership." **Embeddings STORAGE is shared with acorn's pgvector** — acorn
  owns the Postgres/pgvector database as infrastructure; truffle owns the RETRIEVAL semantics on top of it
  (the HNSW query, the iterative-scan setting, the fusion SQL, the dims-vs-index-cap decision). When the task
  is "provision/operate the pgvector DB," route to acorn and keep the relevance layer. Source: mission
  boundary; `ecosystem-04` §1 (dims/storage math); `ecosystem-07` §2.
- **The one-line handoff rule (memorize):** "truffle = the query, the ranking, and the relevance proof; acorn
  = the pgvector box the vectors sit in. truffle does NOT own the LLM that reads the top-8 chunks — it owns
  getting the right top-8." The shared seam (Postgres-vector retrieval) splits exactly there.
- **Energy home:** truffle fills the harness-checklist line `Product · C2 infra | Search | ❌ GAP — only
  in-process BM25 (wikimem)`. It is the owner of `search`; the in-house BM25 layers (memory-search.sh /
  sentinel / llmwiki) stay as the tiny-offline-corpus tool, and truffle SUPERSEDES them for any product-facing
  surface. Source: `ecosystem-07` §2/§4.

---

## JTBD-1 — "Pick a search engine (or use Postgres) — the selection job"

The bread-and-butter. truffle produces a **decision with the honest cost + the corpus-size/control question
answered first**, not a feature table. Full matrix in [[truffle TOOL-MATRIX]].

- **1.1 Ask the routing question BEFORE naming an engine:** *"Does a human end-user type queries into this,
  expecting typo-tolerant, faceted, relevance-ranked results — and at what corpus size, with what ops
  appetite?"* The answer routes the whole decision. "Search platform" ≠ "search box" — most disputes dissolve
  once you separate them. Source: `ecosystem-07` §3 litmus test; `field-01` §4 (Dispute A synthesis).
- **1.2 Default to Meilisearch for the turnkey path** — easiest self-host, best DX, hybrid/AI search ON BY
  DEFAULT (2026, no experimental flag), official MCP + official CLI, ships ~weekly (v1.47, 58K★). Best for
  docs/content search, MVPs, agent-native products where "it just works" + agent-tooling matter most. Source:
  `ecosystem-06` §3; `ecosystem-00` §2; `ecosystem-05` §6.
- **1.3 Reach for Typesense when latency + multi-tenancy dominate** — fastest raw latency (C++, in-memory,
  sub-ms), the cleanest hybrid API (`query_by: "text,embedding"` auto-fuses), and the best multi-tenancy
  primitive in OSS (HMAC scoped keys, JTBD-7). Accept: RAM-bound, fiddly HA Raft, **no official MCP/CLI**.
  Source: `ecosystem-06` §3; `ecosystem-02` §1e; `ecosystem-05` §1.
- **1.4 Reach for Postgres + pg_search (BM25) + pgvector when the app ALREADY runs Postgres** ("one fewer
  service"). The agent drives it via plain `psql`/SQL — the most agent-legible surface of all. Accept: you
  hand-roll RRF fusion in SQL, dims/HNSW caps, and pg_search is younger (no Prisma ORM, weak non-latin, JOIN
  perf maturing). **This is acorn's pgvector substrate — truffle owns the retrieval semantics on it, acorn
  owns the DB.** Source: `ecosystem-06` §3; `ecosystem-04` §4; `ecosystem-05` §6; mission boundary.
- **1.5 Reach for Algolia only when relevance is revenue-critical + budget > engineering time** — best
  relevance defaults (decade-tuned), zero ops, best agentic MCP tooling (two hosted MCPs, "built for the
  agentic era"). Accept: per-query + per-record cost (the classic reason teams migrate AWAY at scale, and the
  WORST fit for a high-internal-query agent) + lock-in. Source: `ecosystem-06` §3; `ecosystem-05` §4;
  `field-02` §4.
- **1.6 Reach for Elasticsearch/OpenSearch only at petabyte scale, logs+search-in-one, or heavy
  aggregations** — accept the ops weight (JVM, cluster ops, shard mgmt, the 10-issue failure catalog of
  JTBD-9). For a typical product search box, BOTH are overkill vs Meili/Typesense/Postgres. ES = AGPL again;
  OpenSearch = Apache-2 + Linux-Foundation-governed. Source: `ecosystem-06` §3; `ecosystem-09` §3; `field-03`.
- **1.7 The two release philosophies to know:** Meilisearch ships **~weekly** (12 releases in 11 weeks) —
  velocity but occasional core-behavior regressions across minors (JTBD-8); Typesense ships **big quarterly
  majors** (v28→v29→v30) — slower but with breaking schema moves. ES/OpenSearch ship monthly/quarterly minors
  with prior-major backports (you're not forced to upgrade immediately). Source: `ecosystem-00` §0;
  `ecosystem-09` §0.

## JTBD-2 — "Build hybrid search (BM25 + vector + fusion) — the core 2026 retrieval job"

The single most load-bearing relevance decision in 2026. **Pure vector search lost the "which is better"
war; the answer is hybrid + rerank.** Source: `field-01` §1.

- **2.1 The 2026 consensus (memorize the framing):** "The production argument stopped being 'which one is
  better' a few years ago. It's now entirely about how precisely you understand where each one fails." Vectors
  are "a feature, not a moat" (the vector-DB gold rush peaked ~2023). Source: `field-01` §1 (TianPan,
  Pureinsights).
- **2.2 Name the failure classes of pure dense retrieval (this IS the taste):** error codes (`0x80070005`),
  product SKUs (`RTX-4090` vs `RTX-4070` look semantically identical), function/library names
  (`torch.nn.functional.cross_entropy`), and rare named entities (signal "averaged away" by pooling). A demo
  that nails "find docs about authentication" can completely fail "find docs mentioning `0x80070005`." Always
  test the lexically-specific query class, not just paraphrase. Source: `field-01` §1.
- **2.3 The complementary-failure law (why hybrid works):** "The failure modes of sparse and dense retrieval
  are complementary — each fills the other's blind spot." BM25 wins exact/rare/IDs/out-of-domain jargon;
  vectors win paraphrase/synonyms/meaning. Hybrid covers both. Source: `field-01` §2; `ecosystem-04` §3.
- **2.4 The hard numbers (WANDS furniture dataset, reproducible):** BM25 alone ~0.6983 NDCG; **pure KNN
  ~0.6953 NDCG (vector LOSES to BM25 out of the box on real e-commerce data)**; basic RRF hybrid ~0.7068
  (beats both immediately); **tuned tiered matching = +7.5% NDCG over BM25** (vs naive RRF's +1.3%). Target a
  "healthy hybrid": Recall@10 = 85–91%, MRR > 0.80, Hit Rate@10 > 90% on YOUR corpus. Source: `field-01` §2.
- **2.5 RRF is the FLOOR, not the finish line.** The big lift is tier/boost tuning ON TOP of fusion, not
  fusion alone. Practitioners who ship RRF and stop leave most of the quality on the table. This is where
  average engineers stop and great ones don't. Source: `field-01` §2; `field-04` §4(3).
- **2.6 The three fusion methods + when each:** **RRF** (`Σ 1/(k+rank)`, k≈60) — rank-based, no score
  normalization needed, the robust de-facto default (ES/OpenSearch/hand-rolled Postgres); **weighted/convex
  (`semanticRatio`)** — Meili's explicit 0→1 knob, simpler to reason about but needs comparable score scales;
  **Rank Fusion (Typesense)** — auto-fused when both text + embedding are in `query_by`, you don't pick the
  math. Source: `ecosystem-04` §3; `ecosystem-02` §1a/§2b.
- **2.7 The exact syntax per engine** (copy-paste-grade, in `ecosystem-02`): Typesense = both fields in
  `query_by` (auto-fuse) OR `vector_query` for BYO-vector + a `distance_threshold` to cut weak semantic
  matches; Meili = `hybrid: { embedder, semanticRatio }`; ES = a `retriever` with `standard`(BM25) +
  `knn`(vector) legs fused by `rrf` (rank_constant ~60); Postgres = two CTEs (pg_search BM25 + pgvector ANN)
  fused with `1.0/(60+rank)` RRF in SQL. Source: `ecosystem-02` §1–4.

## JTBD-3 — "Choose embeddings + add a reranker — the retrieval-quality multipliers"

The two highest-leverage quality moves after hybrid. **Embeddings STORAGE is acorn's pgvector; the embedding
MODEL CHOICE for retrieval quality is truffle's.** Source: `ecosystem-04`; `field-04` §2/§3.

- **3.1 The embedding default ladder:** *safe default* = OpenAI `text-embedding-3-small` (1,536 dims, $0.02/1M,
  62.3 MTEB — most-integrated, every vector DB supports it); *best price/quality* = **Jina v3** ($0.02/1M,
  65.5 MTEB — beats OpenAI's LARGE at 1/6 the price, open-weight, the sleeper pick); *best quality + long
  context* = **voyage-3-large** (67.1 MTEB, **32K token context** — the only major embedder that ingests a
  whole paper in one call); *free* = Google `text-embedding-004`; *self-host* = GTE-large / nomic-v1.5.
  Source: `ecosystem-04` §1.
- **3.2 MTEB is a PRIOR, not an oracle (the killer anecdote):** on a real legal-contract corpus, the MTEB
  top-3 ranked 5th/7th/2nd, and the WINNER (BGE-large-en-v1.5) was MTEB-#11. A 5-pt MTEB gap ≈ only 3-8%
  real recall@10; models tuned ON MTEB overfit. Use MTEB to generate a SHORTLIST, then eval candidates on
  YOUR 200-query golden set. Source: `field-04` §2a; `ecosystem-04` §1 (gotchas).
- **3.3 Embedding gotchas that bite (the load-bearing details):** **dims drive your vector-DB bill** (1024-dim
  float32 = 4KB/vector → 10M docs = 40GB); **pgvector HNSW caps at 2000 dims (4000 with halfvec)** — so OpenAI
  3-large at 3072 dims CANNOT be HNSW-indexed unless you Matryoshka-truncate via the `dimensions` param;
  **shorter chunks (256-512 tok) often retrieve BETTER** than whole docs, so a giant context window matters
  less than vendors imply; **asymmetric embedding** (different `search_document` vs `search_query` input types,
  or different index-time vs search-time embedder — Meili/Typesense/OpenSearch support this in 2026). Source:
  `ecosystem-04` §1; `ecosystem-03` §3 (#461); `ecosystem-09` §2 (3.5 asymmetric).
- **3.4 The reranker mental model (bi-encoder vs cross-encoder):** embeddings = bi-encoder (encode query & doc
  SEPARATELY, compare by cosine — fast, precomputable, scales to millions, loses interaction); a reranker =
  cross-encoder (feed the FULL (query, doc) PAIR through one model → a single relevance score — much more
  accurate, but CAN'T precompute, so you run it at query time on a SHORTLIST of top-50–200). Source:
  `ecosystem-04` §2.
- **3.5 The reranker ROI (hard numbers):** Databricks +48% retrieval quality; MIT cross-encoder two-stage
  +40% RAG accuracy; rerank-then-trim = 72% LLM-cost reduction while preserving 95% accuracy; ~35% fewer
  hallucinations. Rerankers jump nDCG@10 by 5–15 points on long-tail/multi-hop. **If you can do ONE thing to a
  hybrid pipeline, add a reranker.** Source: `ecosystem-04` §2; `field-04` §3a.
- **3.6 But KNOW when NOT to rerank (the discipline):** skip it when (a) latency budget can't absorb
  +200–500ms (≈100ms on GPU) — e.g. autocomplete; OR (b) retrieval is already good enough (bi-encoder MRR@5 >
  0.85) — reranking a near-perfect set is pure latency cost for no gain. Source: `field-04` §3b.
- **3.7 The reranker pick:** Cohere rerank-3.5 = the easy managed drop-in (you pick it for the SLA/managed
  infra, NOT because it wins quality — it's within noise of open bge-large/MonoT5); **bge-reranker-large v2 if
  you can batch on GPU** (matches API latency at zero marginal cost), else bge-base; Voyage rerank for
  instruction-following/conversational; Jina (open-weight, multimodal). Source: `ecosystem-04` §2; `field-04`
  §3c.

## JTBD-4 — "Get faceting + filtering right at scale — where search becomes a SYSTEMS problem"

Faceting is where "search" stops being a query problem and becomes a CPU-vs-latency-vs-disk-vs-cache-vs-
correctness problem. "Faceting is just GROUP BY + COUNT" is the naive model that dies at scale. Source:
`field-02` §1/§2.

- **4.1 The Vinted gold-standard case study (real, not toy):** ~600M items, >2,000 req/s, hit ~120ms P99 /
  ~16ms avg. The dials they used: **cap facet counts ("up to 500, anything above = '500+'")** — exact high
  counts are expensive and users don't care; **reduce cardinality** (the brand field 2M → 40K verified brands
  dropped P99 ~15ms); **`terminate_after` 100,000 docs/shard**; **`size: 0` for aggregation-only requests**;
  dynamic cache duration by result-set size. Source: `field-02` §1.
- **4.2 The deliberate tradeoffs Vinted made (this IS the taste — each is a tradeoff, not a win):** they chose
  separate-aggregation requests despite +20% CPU because item search was ~71ms faster; rejected smaller shards
  (faster but +2x disk) for simpler ops; and accepted SLIGHTLY WRONG facet counts (counted banned users) to
  buy a 5% cache-hit improvement. Great search engineers make pragmatic correctness-vs-performance calls;
  average ones won't. Source: `field-02` §1.
- **4.3 The engine-level "why it's hard":** ES's **global-ordinals tax** — high-cardinality terms aggs are
  "slow and unpredictable" because ES rebuilds a per-shard numbering of every unique term; a real forum case
  went from 400 QPS → 20-30 QPS and 40ms → 500ms latency from turning on ONE facet (a 13-20× collapse).
  Postgres/row-stores are structurally WORSE at faceting (it's "ranked hits AND category counts" in one pass —
  hard on a row store). Source: `field-02` §2.
- **4.4 The Typesense facet sampling escape hatch:** "Typesense = fastest" is true for QUERY latency but NOT
  automatically for high-cardinality FACET counting on huge result sets — there Typesense added SAMPLING
  (`facet_sample_threshold: 100000`, `facet_sample_percent: 10` → estimate counts from 10% of hits). For facets
  over 100K+ matched docs, use sampling (accept APPROXIMATE counts, same tradeoff as Vinted's "500+"), and
  benchmark Meili as a serious alternative for exact facets at scale. Source: `field-05` §2 (#914).
- **4.5 Multi-select facet math (everyone gets it wrong the first time):** when a user selects a filter you
  must STILL show counts for the unselected options of that same facet → a separate query per facet that
  excludes only that facet's own filter. Source: `field-02` §1.
- **4.6 Declare filterable/sortable attributes explicitly — never trust defaults.** Meili silently won't
  filter/sort/highlight an undeclared attribute (`filterableAttributes`/`sortableAttributes` MUST be declared;
  `displayedAttributes` defaults `["*"]` but the others do NOT). ES dynamic mapping is the mirror danger
  (JTBD-9). Source: `ecosystem-02` §2c; `ecosystem-03` §1 (#761/#767/#1630).

## JTBD-5 — "Tune relevance — and accept that search is NEVER done"

The continuous-tuning job. "Search is never done" is not a platitude — it's an architectural requirement.
Source: `field-01` §3; `field-04` §1c.

- **5.1 The #1 trap (the relevance-whack-a-mole law, verbatim):** "The biggest trap people fall into is
  tuning for one or a few 'pet' queries" — perfecting ONE query "can have cascading effects downstream that
  mess up the bulk of your other queries." Relevance is a GLOBAL optimization; every "fix" for a complaint
  query is a potential regression for 1,000 silent ones. Average engineers tune to the loudest stakeholder's
  pet query; great ones gate every change behind a corpus-wide eval set. Source: `field-01` §3; `field-04` §1c.
- **5.2 "Good search LOOKS effortless; it is the most expensive feature to maintain."** "When a service has
  good search that just works, there's often been a lot of engineer hours devoted to identifying which signals
  are most useful, how they relate to subjective relevance, and how to clean them so noise doesn't dominate
  signal." Budget for the continuous loop, not a one-shot index. Source: `field-01` §3.
- **5.3 truffle MUST ship the eval loop, not just the index:** (a) a golden-query eval set, (b) per-query
  regression so a fix for query A can't silently break queries B–Z (the pet-query trap), (c) the expectation
  of a continuous tuning loop. This maps EXACTLY to Energy's RSI/observer pattern (sentinel/darwin) — the
  "relevance never done" loop IS the AutoLab loop applied to search. Source: `field-01` §3.
- **5.4 The per-engine relevance levers:** Meili = the reorderable **ranking-rules pipeline** (words → typo →
  proximity → attribute → sort → exactness; reorder to make a custom field dominate — there's no BM25 k1/b
  knob, you reorder rules); Typesense = `query_by_weights`, `_text_match`/`_vector_distance` pseudo-fields to
  inject business ranking (popularity/recency), synonyms (global in v30), curation (`pinned_hits`/
  `hidden_hits`), decay functions (gaussian/linear/exp) for recency/geo boost; ES = boosts, RRF rank_constant,
  ELSER, `function_score`; Postgres = DIY in SQL. Source: `ecosystem-02` §1c/§1f/§2c; `ecosystem-00` §1 (v28
  decay).
- **5.5 "All search is structured now" (Turnbull, 2025) — the modern pipeline has an LLM front-end.** "search
  is never unstructured"; cheap local LLMs make query understanding (intent, entity extraction, structured-
  filter inference) a default pre-step. The modern pipeline is *string → LLM query-understanding (extract
  filters/intent/entities) → structured hybrid query → fusion → rerank → results*. An agent IS that
  query-understanding layer — truffle is natively positioned to do the thing Turnbull says everyone will move
  to. Typesense v29 Natural Language Search (LLM intent → structured `filter_by`) is the engine-side version
  of this. Source: `field-04` §1b; `ecosystem-00` §1 (v29 NL Search).
- **5.6 Diversify near-duplicate results (the RAG-specific lever):** Typesense v30 added **MMR (Maximum
  Marginal Relevance)** to dedupe near-identical hits in the ranked list — useful so you don't feed the LLM 5
  near-dup chunks. Most OSS engines don't have MMR built in. Source: `ecosystem-00` §1 (v30 MMR).

## JTBD-6 — "Build the canonical 2026 RAG retrieval pipeline"

The end-to-end retrieval pipeline truffle implements (the part before the LLM generates). Source:
`ecosystem-04` §4.

- **6.1 The 7-step pipeline:** (1) **chunk** (256-512 tok with overlap; chunk quality dominates retrieval
  quality); (2) **embed** (default 3-small or Jina v3; long docs voyage-3-large); (3) **index** into a hybrid
  store (Meili/Typesense turnkey, or Postgres+pg_search+pgvector "one fewer service", or ES/OpenSearch at
  scale); (4) **retrieve stage-1** hybrid (BM25+vector, RRF) → top ~100, apply metadata FILTERS here (date,
  tenant, type) — and verify the engine handles filtered-ANN (pgvector ≥0.8!); (5) **rerank stage-2**
  cross-encoder → top ~8; (6) **generate** (top-8 + citations into the LLM — that LLM step is NOT truffle's;
  truffle owns getting the right top-8); (7) **index freshness** (writes are async — re-embed only changed
  docs, watch the index task queue, not just query latency). Source: `ecosystem-04` §4.
- **6.2 The single highest-leverage move:** hybrid retrieve top-100 → cross-encoder rerank → top-8 into
  context. This one pattern is the biggest retrieval-quality lever in 2026. Source: `ecosystem-04` §2/§4;
  `ecosystem-05` §6.
- **6.3 Filters go at stage-1, and filtered-ANN can UNDER-RETURN.** Apply metadata filters during retrieval,
  but verify your engine handles them: pgvector < 0.8 silently returns fewer than LIMIT under a selective
  filter; pgvector ≥0.8 + `hnsw.iterative_scan` re-probes until LIMIT. Source: `ecosystem-04` §4; `ecosystem-03`
  §3 (#259).

## JTBD-7 — "Isolate tenants — multi-tenancy as a search concern"

A multi-tenant agent product MUST isolate tenants at the search layer with NO trust in the client. Source:
`ecosystem-02` §1e.

- **7.1 Typesense scoped keys are the best OSS multi-tenancy primitive.** You bake a `filter_by`
  (`company_id:124`) into an HMAC-signed search key so the tenant filter CANNOT be bypassed client-side —
  server-enforced tenant isolation. Role-based variants
  (`accessible_to_organization_id:=1 && accessible_to_roles:=[sales,marketing]`) work too. Revoking the PARENT
  key invalidates ALL scoped keys derived from it. Source: `ecosystem-02` §1e.
- **7.2 The alternatives:** Meili = tenant tokens (JWT) scoping an index/filter; ES/OpenSearch = index/alias
  per tenant (or document-level security); Postgres = row-level security (DIY); Algolia = managed (secured API
  keys). Source: `ecosystem-06` §1 (multi-tenancy row).
- **7.3 Never put a tenant filter only in the client query** — it's bypassable. Use the engine's
  cryptographic/server-enforced primitive (scoped key / tenant token / RLS). Source: `ecosystem-02` §1e.

## JTBD-8 — "Survive version bumps — the velocity tax of the fast OSS engines"

The fast OSS engines (Typesense, Meili) move quickly and occasionally REGRESS core behavior or change
internals that don't auto-migrate. NEVER treat a search-engine version bump as a no-op. Source: `field-05` §1.

- **8.1 The meta-pattern:** Typesense/Meili move fast and occasionally regress typo tolerance, hybrid
  scoring, or prefix behavior across minors, AND change internals (vector backend, storage format) that don't
  auto-migrate. This is the price of their velocity vs Elasticsearch's slower-but-stabler cadence. truffle
  MUST own a version-bump regression suite — the strongest concrete justification for building the "search is
  never done" eval loop into the harness, not optional. Source: `field-05` §1 (meta-pattern).
- **8.2 The dated war stories to remember:** Typesense v28 SILENTLY broke typo tolerance (#2313, bumping the
  typo params didn't help); v28 EKS pods crashed ~hourly on DNS during rolling updates (#2208 — maintainer:
  "Running Typesense on Kubernetes requires some care," use the community operator); v28 hybrid +
  `symbols_to_index` produced wrong scores (#2365 — the code/identifier indexing case); Meili swapped its ANN
  backend arroy→hannoy (#5767) and a delta-bitmap storage change cut index size 50% but does NOT auto-migrate
  existing data (#5985 — reindex to get the benefit). Source: `field-05` §1a–1e.
- **8.3 The agent rule:** after ANY upgrade, re-run the golden tests — especially the typo-tolerance set
  (single-char substitution, transposition, multi-word typo) and the hybrid-scoring set — BEFORE shipping.
  Read minor-version changelogs for storage/vector internal changes; plan a reindex to get new-format benefits;
  don't assume an upgrade transparently improves anything. Source: `field-05` §1a/§1e.

## JTBD-9 — "Know the Elasticsearch ops failure catalog — so you can recommend it (or not) credibly"

The entire reason Typesense/Meilisearch exist as products is "ES is operationally brutal for simple search."
To recommend an engine credibly truffle must know EXACTLY what ES ops pain looks like — named mechanisms, not
hand-waving. Source: `field-03`.

- **9.1 THE canonical postmortem — a 20MB dataset crashed a 14GB cluster (mapping explosion):** a 15-type
  YAML mapping ballooned to 16,000+ lines of ES JSON because unmapped nested object properties auto-generated
  a mapping per nested field; heap grew disproportionate to data, hit the 75% GC trigger → 99% heap → timeouts
  + data loss. The trap: `not_analyzed` ≠ "not indexed" (a widely-held WRONG mental model). The fix:
  `enabled: false` on rehydration-only fields, explicit index projections, flatten the structure. Source:
  `field-03` §1.
- **9.2 The 10-issue taxonomy (know these cold; discount the "just use Postgres" conclusion as vendor spin):**
  JVM GC pauses; mapping explosion; over/under-sharding ("no formula exists for correct sizing"); the
  **deep-pagination cliff (hard 10,000-result ceiling)**; split-brain & data loss on network partition;
  eventual-consistency surprises (refresh default 1s — "search immediately after save, find nothing"); the
  historic no-auth security misconfig (billion-record breaches from open ports); monitoring complexity;
  data-pipeline sync (Postgres→Kafka/Debezium→ES); infra cost (16–64GB RAM/node, min 3-node). Source:
  `field-03` §2.
- **9.3 The honest synthesis (NOT "ES is bad"):** ES is over-provisioned for the 90% of search that is a
  product search box. Great engineers RIGHT-SIZE — reserve ES/OpenSearch for genuine scale/analytics, reach
  for Meili/Typesense/PG for everything else. The mistake average teams make is reaching for ES BY DEFAULT
  (resume-driven / "it's the standard") then drowning in the 10 issues for a corpus that fits in RAM on one
  box. Source: `field-03` §2/§4.
- **9.4 The 2026 vector-cost reset (why ES is competitive on vectors NOW):** the 9.x arc = "make dense-vector
  search cheap + fast at scale" — BBQ default (95% less heap) → DiskBBQ (vectors on disk, sub-20ms, 100MB
  footprint regardless of index size — the exact constraint that bites in-memory Typesense) → GPU/cuVS
  indexing (12x throughput, GA in 9.4) → multi-bit BBQ (recover recall). OpenSearch tracked it (GPU GA in 3.1)
  AND went further agent-native (MCP agentic search 3.4, agentic conversation MEMORY + LLM-as-judge 3.5).
  Source: `ecosystem-09` §1/§2.
- **9.5 ES vs OpenSearch — the 2026 honest delta:** both converged (GPU/cuVS, Lucene-10, hybrid/RRF,
  semantic/auto-embed field, agentic surfaces). Lean **OpenSearch** for open governance + Apache-2 + the most
  openly agent-native posture (MCP + agentic memory + built-in LLM-as-judge eval); lean **Elasticsearch** for
  the most mature vector-quantization-at-scale story (BBQ default + DiskBBQ + multi-bit) + the polished Agent
  Builder (accept AGPL + single-vendor governance). The 2021 license war is OVER. Caveat: OpenSearch hybrid/RRF
  had correctness bugs as late as 3.5 — eval YOUR hybrid queries on the exact version. Source: `ecosystem-09`
  §3.

## JTBD-10 — "Operate all of this as an AGENT (headless) — the agent-operator surface"

truffle is an agent employee, not a human search engineer. The agent-operator gotchas it must encode. Source:
`ecosystem-05`.

- **10.1 Discover capability via MCP first.** Official MCPs: Meilisearch (`meilisearch/meilisearch-mcp`),
  Elasticsearch (`elastic/mcp-server-elasticsearch`), OpenSearch (`opensearch-project/opensearch-mcp-server-py`),
  Algolia (two hosted: Public + Productivity). Postgres = `crystaldba/postgres-mcp` ("Postgres MCP Pro",
  community-but-serious). **Typesense has NO official MCP and NO official CLI** — only thin community wraps. The
  most agent-legible surface of ALL is Postgres = `psql` + SQL (agents already know SQL). Source: `ecosystem-05`
  §1/§2.
- **10.2 The 10-item agent-operator gotcha checklist (encode into truffle's skills):** (1) **Meili writes are
  ASYNC** — always poll `/tasks/{uid}`, never assume immediate searchability (Typesense/Postgres synchronous;
  ES use `refresh=wait_for`); (2) declare attributes explicitly; (3) filtered vector search can under-return
  (pgvector ≥0.8 + iterative_scan); (4) embedding dims must fit the index cap (HNSW ≤2000/4000); (5) in-memory
  engines are RAM-bound (Typesense holds the WHOLE index incl. vectors; budget RAM = index × ~1.5, test the
  DEPLOY spike); (6) cost-aware on Algolia (batch, partial-update, avoid `deleteBy`); (7) CJK/non-latin
  tokenization is weak everywhere; (8) prefer POST/`multi_search` over GET for complex filters (URL-encoding
  bugs); (9) idempotent index creation (ES historically lacked "create if not exists"); (10) batch operations
  (`multi_search`/`_bulk`/batch add, not single-request loops). Source: `ecosystem-05` §5.
- **10.3 The OSS contribution opportunity:** there's NO official Typesense MCP/CLI — truffle building a clean
  `truffle-typesense` MCP + CLI would fill a real ecosystem gap AND dogfood the Search employee. Source:
  `ecosystem-05` §1/§6.

## JTBD-11 — "Know the canonical reference repos + the in-house BM25 baseline"

The artifacts truffle reads to become dangerous, plus the exact in-house baseline it supersedes. Source:
`ecosystem-01`; `ecosystem-07`.

- **11.1 Engine starters (clone/read):** Typesense — `typesense-instantsearch-adapter` (518★, the way to a
  rich UI by borrowing Algolia's widgets), `bfritscher/typesense-dashboard` (645★, the de-facto admin UI);
  Meilisearch — `meilisearch-js-plugins` (530★, official InstantSearch bridge), `Blazity/enterprise-commerce`
  (690★, REAL Next.js+Meili storefront), `open-wanderer/wanderer` (3,675★, a real app using Meili in anger);
  Postgres — `paradedb/paradedb` (8,938★, the BM25-in-Postgres + hybrid-in-SQL reference). Source:
  `ecosystem-01` §1/§2/§4.
- **11.2 RAG/hybrid reference pipelines:** `oramasearch/orama` (10,413★, full-text+vector+hybrid in a tiny
  embeddable JS lib — best for edge/in-process); `infiniflow/infinity` (4,570★, AI-native hybrid DB);
  `RustyRAG/RustyRAG` (clean readable HNSW-dense + BM25-sparse + fusion reference);
  `theaiautomators/claude-code-agentic-rag-masterclass` (173★ — the one repo matching truffle's identity:
  agent-built RAG, Claude-Code-native — read for HOW, not just WHAT). Source: `ecosystem-01` §3.
- **11.3 The in-house BM25 baseline truffle supersedes (3 layers):** `energy/scripts/memory-search.sh` (grep
  `tf × source_weight × recency_weight` — NOT real BM25: no IDF, no length normalization, O(files)/query);
  `sentinel/access/brain_search.py` (a TEXTBOOK-correct Okapi BM25, k1=1.5/b=0.75 — genuinely good for a small
  offline corpus, but re-tokenizes the whole corpus per query, no persisted index); `llmwiki/src/search/
  bm25.ts` (solid in-process BM25 with title boost). NONE provide: inverted index/persistence, typo tolerance,
  faceting, vector/hybrid, multi-tenancy, reranking. Source: `ecosystem-07` §1.
- **11.4 The right boundary — don't over-correct:** KEEP the in-house BM25 for small/local/offline/zero-dep
  corpora (agent memory, a few hundred markdown notes, CI-time search). USE truffle/a real engine for any
  PRODUCT-facing surface, multi-tenant data, thousands+ of docs, or when typo/facets/hybrid/rerank/relevance
  quality is user-visible. The litmus test: *"Does a human end-user type queries expecting typo-tolerant,
  faceted, relevance-ranked results?"* → real engine. *"Is it an agent grepping its own notes offline?"* →
  in-house BM25 is fine. Source: `ecosystem-07` §3.

---

## How to use this map (the routing reflex)

1. **Place the task on the boundary first** (the top section). If it's "where do the vectors physically live /
   provision the pgvector DB," cite acorn's pgvector ownership and keep only the retrieval layer. If it's the
   LLM generation step, that's downstream of truffle.
2. **Route to a JTBD node**, read its sub-points, and check [[truffle KNOWN-PITFALLS]] for the version-specific
   gotcha before acting.
3. **For any "which engine / should we" question, answer the corpus-size/control routing question FIRST
   (JTBD-1.1), then produce a decision with the honest cost** ([[truffle TOOL-MATRIX]] + [[truffle OPINIONS]])
   — never a feature checkbox.
4. **For any relevance change, gate it behind a corpus-wide eval set** (JTBD-5.1 the pet-query trap). Never
   tune to one loud query. After any version bump, re-run the regression suite (JTBD-8.3).
5. **When sources disagree, read [[truffle GAPS-AND-DISPUTES]]** for the resolved stance + the open question.
