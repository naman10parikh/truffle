---
title: "Search Ecosystem — Real-World Breakage from GitHub Issues (June 2026)"
type: source
created: "2026-06-17"
updated: "2026-06-17"
tags: [search, issues, breakage, postmortem, gotchas, typesense, meilisearch, pgvector, elasticsearch]
summary: "High-engagement closed/open GitHub issues that reveal real production breakage, version-specific gotchas, and the limits of each search engine. Sorted by reactions/comments — these are what bites operators, not marketing claims."
researcher: "truffle ECOSYSTEM (CP123 Wave-R)"
---

# Real-World Breakage — GitHub Issues (the stuff that actually bites)

> METHOD: ranked by `sort:reactions-desc` and `sort:comments-desc` via
> `gh api search/issues`, run 2026-06-17. High comment count = real debugging pain;
> high reactions = many people hit it. I read the bodies/maintainer replies, not just titles.

---

## 1. MEILISEARCH — the operator gotchas

### #5616 — "Massive perf degradation on indexing after upgrading 1.13 from 1.8" (29💬, closed 2025-08-21)
- VERSION-SPECIFIC MIGRATION GOTCHA. User upgraded 1.8 → 1.14; on deploy, memory spiked
  to **4GB then settled under 1GB** — previously steady under 2GB. Broke their ability to
  deploy on a 2GB instance (Render). Root cause tied to **vector storage** in the index +
  the indexer's new memory profile.
- TAKEAWAY for truffle: Meilisearch memory profile changed materially across the 1.8→1.14
  arc. If you store vectors, budget MUCH more deploy-time RAM headroom than steady-state
  suggests. Test the DEPLOY spike, not just running footprint.
- Source: https://github.com/meilisearch/meilisearch/issues/5616 (accessed 2026-06-17)

### #4093 — "The matching strategy is flawed" (27💬, closed 2023-10-11)
- THE classic Meili relevance gotcha. Doc field = "Apple MacBook". Query `appl macbook`
  (one realistic typo) → **document NOT returned** with default settings.
- Why: Meili's default `matchingStrategy: last` + how typo tolerance interacts with the
  proximity/words ranking rules can drop a doc when an early word is typo'd. Fix paths:
  `matchingStrategy: all` vs `frequency`, tuning typo thresholds, or relaxing.
- TAKEAWAY: Meili's default matching strategy is NOT "find everything with typos"; it can
  silently exclude. An agent indexing data must test typo'd multi-word queries explicitly.
- Source: https://github.com/meilisearch/meilisearch/issues/4093 (accessed 2026-06-17)

### #1098 — "Meilisearch slow on updates, backlogged/behind by 30-50min" (42💬)
- Indexing throughput collapse under sustained writes; the async task queue backs up by
  30-50 minutes. Directly relevant to the async-task model (see agent-operator file): writes
  are queued, and under load the queue is the bottleneck, not query latency.

### #3466 — "Chainsaw: Server CPU load + Disk IO + Disk storage always increasing" (28💬)
- Monotonic resource growth (a compaction / merge / log-growth bug class). Classic
  "looks fine in dev, slowly eats the box in prod" failure. Operators must monitor disk
  trend, not just point-in-time.

### #1969 — "Docker v0.24 does not write data in /data.ms anymore" (46💬) + #2255 "Unclear error
when there is not enough space left" (30💬)
- Two flavors of the same operational class: data-dir/volume mounting confusion in Docker,
  and opaque out-of-disk errors. The #1 Meili-in-Docker footgun is the data volume.

### #1630 — "attributesToHighlight does not work" (42💬) + #761 facets-not-in-displayedAttributes (35💬)
+ #767 "Attributes known by MeiliSearch but invisible for the user" (28💬)
- A whole CLUSTER about the **attribute declaration model**: `searchableAttributes`,
  `displayedAttributes`, `filterableAttributes`, `sortableAttributes`. If you don't declare
  an attribute correctly, it silently won't highlight / filter / show. This is the single
  most common Meili confusion. AGENT RULE: explicitly set the attribute lists; don't rely
  on defaults (`displayedAttributes` defaults to `["*"]` but the others do NOT for
  filter/sort).

### #1195 — "Heed error: Function not implemented (os error 38)" (29💬)
- LMDB (heed) on certain filesystems (NFS, some overlay/Docker FS) → ENOSYS on the mmap
  syscalls. Meili's storage is LMDB; it MUST be on a real local filesystem, not NFS.
  AGENT RULE: never put `/data.ms` on network storage.

---

## 2. TYPESENSE — the operator gotchas

### #465 — "Cluster (HA) is not using 'nodes' configuration" (74💬) + #203 "Nodes and Kubernetes" (43💬)
- The single biggest Typesense operational pain: **running a highly-available Raft cluster
  is fiddly.** The `--nodes` file (peering config) is easy to get wrong; K8s StatefulSet
  networking (stable peer DNS, the nodes file, quorum) trips many. 74 comments of people
  failing to form a cluster.
- TAKEAWAY: Typesense single-node is trivial; Typesense HA cluster is a real project. If
  truffle needs HA, budget for it or use Typesense Cloud.

### #644 — "Typesense CPU is always at 100%" (26💬, v0.23) + #1067 "OOM for collection export" (26💬)
- Periodic CPU spikes to 100% for 15-30 min once/day (older versions); and OOM when
  exporting a large collection (export loads too much into memory). Memory/CPU behavior
  under big collections is a known sharp edge. Typesense is IN-MEMORY — the whole index
  (and vectors) must fit in RAM. This is the defining constraint.

### #1002 — "Typesense crashes when locale is ja (Japanese) on Ubuntu 22.04 ARM64 Docker" (30💬)
- Locale/tokenizer + ARM + specific OS = crash. CJK tokenization is a known weak spot
  across these engines. If truffle indexes CJK, test the exact arch/OS, don't assume.

### #210 — "Range filter works incorrectly (URL encoding issue)" (31💬)
- Range filters via GET requests broke on URL-encoding of `[`, `]`, `..`. Reinforces:
  prefer POST/multi-search for complex `filter_by`, don't build filter strings into a GET
  URL by hand. (Relevant to agents constructing queries programmatically.)

### Feature-gaps that took years (high-reaction FRs, now mostly shipped)
- #227 nested-field indexing (59👍, 73💬) — nested fields weren't supported for a long
  time; now they are. #1706 faceting on JOINed reference fields (34👍) — shipped in v30.
  #834 stemming/lemmatization (25👍) — shipped v28 (dictionary stemming). #248 stopwords
  (24👍). These show Typesense's historical gaps; most are closed now, but the LATENCY from
  request→ship was long. If truffle needs a feature not yet shipped, expect a wait.

---

## 3. PGVECTOR — the filtered-ANN problem (the big one)

### #259 — "Understanding HNSW + filtering" (61👍, 87💬, closed)
- THE canonical thread. The problem: HNSW (and IVFFlat) ANN indexes return the top-K
  nearest vectors, but if you then apply a WHERE filter (`category_id=5`), you can get
  FEWER than K results back — because the filter prunes the already-retrieved K, and the
  matching rows might be outside the ANN's explored neighborhood. Maintainers
  **@jkatz (Jonathan Katz)** and **@ankane (Andrew Kane)** discuss filtered-HNSW designs
  (a "two sets of links" multi-column index idea where one link-set is filter-specific).
- RESOLUTION: pgvector **0.8.0 (Oct 2024)** shipped **iterative index scans** — when a
  filtered ANN scan under-returns, Postgres re-probes the index (relaxing radius) until it
  reaches LIMIT. This is the single most important correctness fix for "vector search in my
  existing Postgres." Before 0.8, you'd silently get too few rows under a selective filter.
- AGENT RULE: if using pgvector < 0.8, filtered vector search is BROKEN for selective
  filters. Use ≥ 0.8 and enable iterative scans (`hnsw.iterative_scan = relaxed_order` or
  `strict_order`). Quote: jkatz's "multi-column links" sketch + the iterative-scan fix.
- Source: https://github.com/pgvector/pgvector/issues/259 (accessed 2026-06-17)

### #461 — "Increase max vectors dimension limit for index" (36👍, 58💬)
- HNSW/IVFFlat indexes are capped at **2000 dimensions** (the column type allows 16,000 but
  you can't INDEX above 2000). So OpenAI `text-embedding-3-large` at 3072 dims CANNOT be
  HNSW-indexed directly — you must reduce dimensions (3-large supports `dimensions` param)
  or use `halfvec` (halfvec raises the index cap to 4000). AGENT RULE: pick embedding dims
  ≤ 2000 (or ≤4000 with halfvec) if you want an index. This bites people constantly.

### #409 parallel HNSW index builds (13👍, 26💬) + #285 DiskANN interest (10👍)
- HNSW index BUILD time on large tables is slow and was single-threaded for a while
  (parallel builds added later). For very large corpora people ask for DiskANN (disk-based
  ANN, less RAM) — not in pgvector; that's where pgvecto.rs / VectorChord / Qdrant come in.

---

## 4. ELASTICSEARCH / OPENSEARCH — the heavyweight signals

### ES #42326 "Investigate ANN search for vector fields" (144👍, 54💬) + #78473 "Integrate ANN" (92👍)
- Vector/ANN search was a MULTI-YEAR retrofit onto Lucene, hugely demanded. Today ES has
  dense_vector + kNN + RRF (hybrid) + ELSER (sparse) + `semantic_text`, but the lineage
  shows it's bolted onto a keyword engine, not vector-native. Maturity is high now; history
  explains why it's heavier than vector-native stores.
- Source: https://github.com/elastic/elasticsearch/issues/42326 (accessed 2026-06-17)

### ES #4915 "Paging support for aggregations" (134👍, 207💬 — the most-discussed issue)
- Deep pagination + aggregations is a perennial ES pain (the `composite` agg was the
  partial answer). Signals: ES is powerful but its query/agg model has sharp edges that
  generate enormous threads.

### ES #19862 "No easy way of creating index only if not exists" (58👍) + #25152 "Provide OpenAPI
spec out of the box" (62👍)
- DX papercuts: idempotent index creation and a machine-readable API spec were long-missing
  — both relevant to an AGENT operating ES (agents want idempotent ops + a schema to codegen
  against). ES finally shipped an OpenAPI spec; still, the API surface is huge.

### OpenSearch #1018 "Add flattened field type" (33👍, 83💬) + #472 "Change 'Master' nomenclature" (35👍)
- Flattened/dynamic-field handling is a long thread; and the project did the
  master→cluster-manager rename. OpenSearch tracks ES feature-for-feature but lags, and
  carries its own governance/naming work.

---

## 5. PARADEDB (pg_search — BM25 in Postgres) — honest current limits
Source: `gh api search/issues repo:paradedb/paradedb` (accessed 2026-06-17)
- #1100 "pg_search support for Prisma ORM" (OPEN, 28💬) — ORM integration is immature; if
  truffle uses Prisma/Drizzle, pg_search is raw-SQL only today.
- #1793 / #1062 "Stemming based on language column" / multi-language snowball (OPEN) —
  per-row/per-language stemming not solved; English-centric.
- #3782 "Improve Fuzzy Matching for non-latin tokenizers" (OPEN) — CJK/non-latin fuzzy is
  weak (same theme as Typesense #1002, Meili tokenizer issues — CJK is everyone's weak spot).
- #2997 "JOIN pushdown" + #4152 JoinScan concurrency — JOIN performance still maturing.
- TAKEAWAY: ParadeDB `pg_search` is real BM25-in-Postgres and shipping fast (v0.24 Jun 2026),
  but it's younger: ORM support, non-latin tokenization, and JOIN perf are the rough edges.

---

## 6. Cross-cutting breakage themes (the patterns)

1. **CJK / non-latin tokenization is EVERYONE'S weak spot** (Typesense #1002, Meili
   tokenizer, ParadeDB #3782). If truffle serves non-English, test the exact language path.
2. **Async indexing surprises** (Meili task-queue backlog #1098; ES/OpenSearch refresh
   interval). Writes are not instantly searchable; under load the indexer is the bottleneck.
3. **Memory/RAM is the binding constraint** for the fast in-memory engines (Typesense whole
   index in RAM #644/#1067; Meili deploy-spike #5616). Vectors blow this up fast.
4. **Filtered ANN under-returns** unless the engine handles it (pgvector pre-0.8; a known
   class everyone has to solve). Verify your engine/version does iterative/relaxed scans.
5. **Attribute/field declaration is silent-failure-prone** (Meili attribute lists; ES
   dynamic mapping). Declare schema explicitly; never trust defaults for filter/sort/highlight.
6. **HA clustering is a separate project** (Typesense Raft #465; ES/OpenSearch cluster ops).
   Single-node is easy everywhere; HA is where the real ops cost lives.
