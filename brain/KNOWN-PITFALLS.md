---
title: "truffle KNOWN-PITFALLS — version-specific gotchas with detection + avoidance"
type: synthesis
domain: search
created: 2026-06-17
updated: 2026-06-17
tags: [pitfalls, gotchas, typesense, meilisearch, pgvector, elasticsearch, opensearch, embeddings, reranking, faceting, truffle, cp123]
sources: ["brain/research/raw/ecosystem-03-github-issues-real-breakage.md", "brain/research/raw/ecosystem-05-agent-operator-clis-mcps.md", "brain/research/raw/ecosystem-04-embeddings-reranking-rag.md", "brain/research/raw/ecosystem-02-docs-deep-dive-flows.md", "brain/research/raw/ecosystem-00-versions-and-changelogs.md", "brain/research/raw/ecosystem-09-es-opensearch-minor-deltas.md", "brain/research/raw/ecosystem-07-internal-bm25-vs-real-search.md", "brain/research/raw/field-01-hybrid-beats-vector-and-relevance-hell.md", "brain/research/raw/field-02-faceting-at-scale-and-migration-war-stories.md", "brain/research/raw/field-03-elasticsearch-ops-nightmares.md", "brain/research/raw/field-04-explicit-taste-from-great-practitioners.md", "brain/research/raw/field-05-version-gotchas-disputes-and-2026-shifts.md"]
related: ["[[truffle EXPERTISE-MAP]]", "[[truffle BATTLE-TESTED-SCENARIOS]]", "[[truffle OPINIONS]]", "[[truffle TOOL-MATRIX]]"]
summary: "The gotcha list — version-specific and dated where possible, each with a DETECT signal and an AVOID rule. These are the traps that silently return wrong results, blow up the cluster, or break a headless agent run. Sourced from GitHub issues (gh-api-verified), engineering postmortems, and practitioner taste as of June 2026."
---

# truffle KNOWN-PITFALLS

> Each pitfall: **what breaks → how to DETECT it → how to AVOID it**, dated/versioned where the research gives
> it. The ones marked ⚠️CURRENT-BUG are live OPEN issues as of June 2026 — re-check before relying on the
> affected surface. Cross-ref scenarios in [[truffle BATTLE-TESTED-SCENARIOS]].

---

## Operator pitfalls (driving the engines as an agent)

### P1 — Meilisearch writes are ASYNC; a doc isn't searchable right after POSTing it
- **Breaks:** An agent POSTs docs and immediately queries → finds nothing; under sustained writes the task
  queue backlogs 30-50 min (the indexer, not query latency, is the bottleneck). Source: `ecosystem-02` §2d;
  `ecosystem-03` §1 (#1098).
- **Detect:** New docs (or new settings/embedder config) aren't reflected immediately; `/tasks` shows
  `enqueued`/`processing`; queue depth grows under load.
- **Avoid:** Treat Meili indexing as eventually-consistent — poll `GET /tasks/{uid}` until `status:
  "succeeded"` before assuming searchability; monitor queue depth + disk trend. (Typesense/Postgres synchronous;
  ES `refresh=wait_for`; Typesense returns `HTTP 503 Lagging or Not Ready` under heavy bulk → retry+backoff.)

### P2 — Undeclared filterable/sortable/searchable attributes silently fail (Meili attribute model)
- **Breaks:** Filtering/sorting/highlighting an attribute you didn't declare returns nothing or errors — no
  obvious failure. A whole issue cluster (#1630 highlight, #761/#767 facets/visibility, ES dynamic-mapping
  mirror). Source: `ecosystem-03` §1; `ecosystem-02` §2c.
- **Detect:** Filter/sort/facet/highlight on an attribute returns empty or an "attribute not filterable"
  error; you relied on defaults.
- **Avoid:** Declare `searchableAttributes`/`filterableAttributes`/`sortableAttributes` EXPLICITLY before
  filtering/sorting/faceting. `displayedAttributes` defaults `["*"]` but the others do NOT. Never trust defaults
  for filter/sort/highlight.

### P3 — Assuming Typesense has an official MCP/CLI (it's REST-only-in-practice as of 2026-06-17)
- **Breaks:** An agent flow built on "toggle the Typesense MCP" / "run the Typesense CLI" fails — there's no
  first-party MCP or CLI, only thin community wraps (`avarant/typesense-mcp-server` 8★, `akshitkrnagpal/
  typesensekit` 2★, `AlexBV117/typesense-cli` 17★). Source: `ecosystem-05` §1/§2.
- **Detect:** No `typesense/*-mcp` or `typesense/*-cli` under the official org via `gh api`; only REST.
- **Avoid:** Drive Typesense via its **REST API** (`X-TYPESENSE-API-KEY`, `/multi_search` to batch). Reserve
  MCP-first for Meilisearch / Elasticsearch / OpenSearch / Algolia (all official). (Opportunity: truffle could
  BUILD a clean official-quality Typesense MCP/CLI.)

### P4 — Building filter strings into a GET URL (URL-encoding corruption)
- **Breaks:** Complex `filter_by` via GET breaks on URL-encoding of `[`, `]`, `..` — range filters return
  wrong results (Typesense #210, 31💬). Source: `ecosystem-03` §2; `ecosystem-05` §5.
- **Detect:** Range/IN-list filters behave wrongly only over GET; work over POST.
- **Avoid:** Prefer **POST / `multi_search`** for complex filters; never inline a hand-built filter string into
  a GET URL. Agents constructing queries programmatically should POST.

### P5 — In-memory engines are RAM-bound; the WHOLE index (incl. vectors) must fit in RAM
- **Breaks:** Typesense holds the entire index in RAM → OOM on large collection EXPORTS (#1067), periodic
  CPU-100% spikes (#644); Meili memory spiked to 4GB on a 1.8→1.14 upgrade DEPLOY before settling under 1GB,
  breaking deploys on a 2GB instance (#5616). Vectors blow this up fast. Source: `ecosystem-03` §1/§2;
  `ecosystem-06` §2.
- **Detect:** OOM under big exports/bulk loads; steady-state RAM looks fine but the DEPLOY spike OOMs; vector
  storage dominates memory.
- **Avoid:** Budget **RAM ≈ index size × ~1.5**, and TEST THE DEPLOY-TIME MEMORY SPIKE, not just steady-state.
  For large-scale vectors without holding them in RAM, ES DiskBBQ (sub-20ms, 100MB footprint regardless of
  index size) or a disk-ANN store is the structural answer.

### P6 — Typesense HA Raft clustering is a separate project (fiddly peering / K8s DNS)
- **Breaks:** Forming a highly-available Typesense cluster is hard — the `--nodes` peering file is easy to get
  wrong (#465, 74💬), and on K8s pods crash ~hourly when the headless-service DNS record is briefly removed
  during rolling updates (#2208, maintainer: "Running Typesense on Kubernetes requires some care"). Source:
  `ecosystem-03` §2; `field-05` §1b.
- **Detect:** `[E112]Not connected to <peer>:8107 yet` / `Connection timed out [110]` during deploys; quorum
  won't form.
- **Avoid:** Single-node Typesense is trivial; for HA use the **community Typesense Kubernetes operator** (not a
  hand-rolled StatefulSet), expect transient peering errors during rolling deploys, and ensure they self-heal
  (don't crash-loop). Or use Typesense Cloud.

### P7 — Treating faceting as "GROUP BY + COUNT" (it's a systems problem that collapses at scale)
- **Breaks:** Turning on ONE high-cardinality facet collapses ES throughput 400 → 20-30 QPS and latency 40ms →
  500ms (the global-ordinals tax); Postgres/row-stores are structurally worse. Source: `field-02` §2;
  `ecosystem-02` §2c.
- **Detect:** Throughput collapse / latency blowup after enabling a high-cardinality facet; faceting on 100K+
  result sets is slow.
- **Avoid:** Apply the dials — reduce cardinality (2M→40K = ~15ms), cap counts ("500+"), `terminate_after`,
  `size:0` for agg-only, Typesense `facet_sample_*` for 100K+ matched docs (approximate counts as a tradeoff),
  multi-select exclusion queries. Faceting is CPU-vs-latency-vs-disk-vs-cache-vs-correctness.

---

## Embedding / reranking pitfalls (the vector-quality layer)

### P8 — Embedding dims exceed the index cap (OpenAI 3-large 3072 dims can't be HNSW-indexed)
- **Breaks:** pgvector HNSW/IVFFlat caps at **2,000 dims (4,000 with halfvec)** though the column allows
  16,000 — so a 3,072-dim embedder can't be indexed; you silently get no ANN index (#461, 36👍). Source:
  `ecosystem-03` §3; `ecosystem-04` §1.
- **Detect:** HNSW index creation fails / refuses above the dim cap; "best quality" model can't be ANN-indexed.
- **Avoid:** Pick dims ≤ 2,000 (≤ 4,000 halfvec), OR **Matryoshka-truncate** via the `dimensions` param
  (OpenAI/Cohere) to 1024/512. Dims also drive the storage bill (1024-dim float32 = 4KB/vector → 10M = 40GB).

### P9 — Picking the embedding/reranker model by MTEB/leaderboard rank
- **Breaks:** The MTEB top-3 ranked 5th/7th/2nd on a real legal corpus; the WINNER was MTEB-#11. MTEB is
  gameable/overfit; a 5-pt gap ≈ 3-8% real recall@10. Source: `field-04` §2a; `ecosystem-04` §1.
- **Detect:** Model choice justified by "it's #1 on MTEB"; no domain eval.
- **Avoid:** **MTEB is a prior, not an oracle** — use it to shortlist, then eval candidates on YOUR 200-query
  golden set. Same for reranker vendor benchmarks (ZeroEntropy's "+18% vs Cohere" is on their OWN bench).

### P10 — Asymmetric-embedding mismatch (embedding query and doc the same way when they shouldn't be)
- **Breaks:** Cohere embed-v4 (and others) have distinct `search_document` vs `search_query` input types;
  using the wrong type, or the same embedder both ways when an asymmetric setup is intended, degrades recall.
  Source: `ecosystem-04` §1; `ecosystem-09` §2 (OpenSearch 3.5 asymmetric support).
- **Detect:** Recall worse than expected with a model that has asymmetric input types / a separate query
  embedder.
- **Avoid:** Use the correct input type per side; on Meili/Typesense/OpenSearch (2026) you CAN set a different
  index-time vs search-time embedder — use it deliberately, don't accidentally mismatch. Also: Cohere embed-v4
  has a **512-token cap** — chunk accordingly.

### P11 — Bolting a reranker onto everything (latency cost where it buys nothing)
- **Breaks:** A reranker adds +200-500ms/query (≈100ms GPU) — fatal for sub-100ms autocomplete — and reranking
  an already-good set (bi-encoder MRR@5 > 0.85) is pure latency cost. Source: `field-04` §3b.
- **Detect:** A reranker on a latency-critical surface; reranking when stage-1 already returns near-perfect
  top-5.
- **Avoid:** Skip the reranker when (a) latency can't absorb +100-500ms, or (b) MRR@5 already > 0.85. Add it
  where it earns its latency (ambiguous/long-tail/multi-hop, precision-critical, RAG paying per token).

### P12 — Trusting reranker/embedder VENDOR benchmarks as neutral
- **Breaks:** Vendor "we beat X by N%" numbers are on the vendor's OWN benchmark (ZeroEntropy "+18% NDCG@10 vs
  Cohere"; Voyage "+14% vs OpenAI" on Voyage's RTEB — the neutral MTEB gap is only ~2.5pt). Source:
  `ecosystem-04` §2; `ecosystem-08` §2 (item 5).
- **Detect:** A head-to-head improvement % sourced from the winning vendor's blog/own benchmark.
- **Avoid:** Trust the neutral cites (Databricks +48%, MIT +40% for the cross-encoder PATTERN) and the
  architecture facts; treat head-to-head vendor numbers as marketing. Decide on YOUR corpus.

---

## Relevance / hybrid pitfalls

### P13 — Shipping RRF and stopping (RRF is the FLOOR, not the finish line)
- **Breaks:** Naive RRF is only +1.3% over BM25 on WANDS; tuned tiered boosting is +7.5%. Stopping at RRF
  leaves most achievable relevance unrealized. Source: `field-01` §2.
- **Detect:** "We do hybrid + RRF, we're done"; no tiered tuning; metrics below Recall@10 85-91% / MRR > 0.80.
- **Avoid:** Ship RRF as the floor, then tune tiered boosting (all-term 100×, any-term 10×, vector fallback
  0.1×) for revenue-critical relevance, gated on a golden-set metric. (RRF + a reranker is fine for "good
  enough RAG grounding" — depends on whether relevance is revenue-critical.)

### P14 — ⚠️CURRENT-BUG: Typesense v28 silently regressed typo tolerance (#2313, OPEN)
- **Breaks:** After upgrading to v28, even single-char typos ("d" for "t") return ZERO matches — previously
  handled — and raising the typo params doesn't help (Typesense #2313, 2025-04-24, OPEN). Source: `field-05`
  §1a.
- **Detect:** Post-upgrade, typo'd queries that used to match now return nothing; bumping `num_typos`/thresholds
  has no effect.
- **Avoid:** **NEVER treat a search-engine version bump as a no-op.** Re-run typo-tolerance golden tests
  (single-char substitution, transposition, multi-word typo) after ANY upgrade BEFORE shipping; pin the prior
  version if a minor regresses a core behavior; re-check whether #2313 is fixed before relying on v28+ typo.

### P15 — Fast OSS engines change internals that DON'T auto-migrate (Meili arroy→hannoy, delta-bitmap)
- **Breaks:** Meili swapped its ANN backend arroy→hannoy behind a flag (#5767) and a delta-bitmap storage
  change cut index size 50%/30% but does NOT auto-convert existing data (#5985) — a version bump can leave you
  on the old (larger/slower) format until you reindex. Source: `field-05` §1e.
- **Detect:** Vector behavior/perf shifts between Meili minors; index size doesn't drop after an upgrade that
  claimed a reduction.
- **Avoid:** Read minor-version changelogs for storage/vector-internal changes; **plan a reindex** to get
  new-format benefits; don't assume an upgrade transparently improves vectors/storage.

### P16 — ⚠️CURRENT-BUG: Typesense hybrid + `symbols_to_index` produces wrong scores (#2365, OPEN)
- **Breaks:** Indexing code/identifiers (needs symbols indexed) + hybrid search → wrong text scores, broken
  highlights, missing `text_match_info` (Typesense #2365, 2025-05-15, OPEN). The SKU/code/API-name failure
  class hitting at the fusion layer. Source: `field-05` §1c.
- **Detect:** Hybrid results over symbol-indexed code fields rank/highlight nonsensically; no `text_match_info`.
- **Avoid:** Test the exact code/identifier + hybrid combo on the target version; consider a keyword-only
  (BM25) leg for the code field + a separate vector leg, or pin a working version, and track the issue.

---

## Vector-DB / filtered-ANN pitfalls

### P17 — Filtered vector search under-returns (fewer than LIMIT) on pgvector < 0.8
- **Breaks:** An ANN scan returns top-K, then a WHERE filter prunes them → you get FEWER than LIMIT rows
  silently, because matching rows lie outside the ANN's explored neighborhood (#259, 61👍/87💬). Source:
  `ecosystem-03` §3.
- **Detect:** A selective filter on a vector query returns 3 rows when you asked for 10; no error.
- **Avoid:** Use **pgvector ≥ 0.8.0** + enable **iterative scans** (`SET hnsw.iterative_scan='relaxed_order'`
  or `'strict_order'`) so Postgres re-probes until LIMIT. Verify ANY engine handles filtered-ANN before
  applying stage-1 filters. (pgvector < 0.8 + selective filter = broken.) **The DB is acorn's; the
  iterative-scan setting is truffle's retrieval concern.**

### P18 — HNSW index BUILD on large tables is slow / was single-threaded
- **Breaks:** HNSW build on a large corpus is slow (was single-threaded before parallel builds; #409); very
  large corpora want DiskANN which pgvector lacks (→ pgvecto.rs/VectorChord/Qdrant). Source: `ecosystem-03` §3.
- **Detect:** Index build dominates bulk-load time; RAM pressure during build on a huge table.
- **Avoid:** Use parallel HNSW builds (newer pgvector), build the index AFTER bulk-load, and for very large
  RAM-constrained corpora consider a disk-ANN store (ES DiskBBQ, or a dedicated vector DB) — accept it's beyond
  pgvector's design point.

---

## Heavyweight (ES/OpenSearch) pitfalls

### P19 — Unbounded dynamic mapping explodes cluster state (`not_analyzed` ≠ not indexed)
- **Breaks:** A 15-type mapping ballooned to 16,000+ lines on a 20MB dataset and crashed a 14GB cluster — heap
  grew disproportionate to data, hit the 75% GC trigger → 99% heap → data loss. `not_analyzed` does NOT prevent
  indexing. Logging clusters hit the same when log values become field names (600+ fields). Source: `field-03`
  §1/§3.
- **Detect:** Cluster state (mapping JSON) growing far faster than data; heap pressure; GC storms.
- **Avoid:** Declare schema explicitly (map ONLY needed fields), flatten the structure, `enabled: false` on
  rehydration-only object fields (not analyzed AND not indexed), set `index.mapping.total_fields.limit`. Never
  leave dynamic mapping unbounded for semi-structured/log-shaped data.

### P20 — The ES deep-pagination cliff (hard 10,000-result ceiling, exponential latency)
- **Breaks:** ES fetches + ranks ALL results before truncating; there's a hard 10,000-result ceiling and
  latency degrades exponentially with offset (the most-discussed ES issue ever, #4915, 207💬). Source:
  `field-03` §2; `ecosystem-03` §4.
- **Detect:** Pagination past ~10K fails or is unbearably slow; `from`+`size` deep offsets time out.
- **Avoid:** Use `search_after` / point-in-time / the `composite` agg for deep pagination; don't design UX that
  pages arbitrarily deep. (A structural ES limit, not a version bug.)

### P21 — Other ES ops failure modes (GC pauses, sharding, split-brain, eventual consistency, security)
- **Breaks:** JVM stop-the-world GC pauses (>30s trigger failover cascades); over/under-sharding with "no
  formula for correct sizing"; split-brain + data loss on network partition; refresh-lag eventual consistency
  ("search immediately after save, find nothing"); historic no-auth shipping (billion-record breaches). Source:
  `field-03` §2; `ecosystem-09`.
- **Detect:** Node freezes during GC; shard count chosen by guess; dual master election; stale results after
  write; open ES port.
- **Avoid:** These are why ES is over-provisioned for a product search box — RIGHT-SIZE to Meili/Typesense/PG
  unless you genuinely need scale/analytics. If on ES: quorum/`minimum_master_nodes`, careful shard sizing,
  `refresh=wait_for` when needed, auth ON, monitoring with a baseline.

### P22 — OpenSearch hybrid/RRF had correctness bugs as late as 3.5 (eval your exact version)
- **Breaks:** OpenSearch shipped RRF score-calculation fixes, `min_score` in hybrid, collapse bugs, and
  different-shard-count edge-case fixes as recently as **3.5 (Feb 2026)** — i.e. hybrid/RRF was provably buggy
  until very recently. Source: `ecosystem-09` §2.
- **Detect:** Hybrid results rank inconsistently across shards / score oddly on an older OpenSearch minor.
- **Avoid:** If leaning on OpenSearch hybrid, eval YOUR hybrid queries on the EXACT version; prefer ≥3.5 for
  the RRF fixes; re-run hybrid-scoring golden tests after upgrades.

---

## Cross-engine + baseline pitfalls

### P23 — CJK / non-latin tokenization is weak EVERYWHERE
- **Breaks:** Typesense crashes on `locale: ja` on Ubuntu 22.04 ARM64 Docker (#1002); ParadeDB non-latin
  fuzzy is weak (#3782); Meili tokenizer issues. CJK is every engine's weak spot. Source: `ecosystem-03` §1/§5;
  `ecosystem-05` §5.
- **Detect:** Crashes / poor relevance / broken typo-tolerance on CJK/non-latin content; assumed the English
  path generalizes.
- **Avoid:** TEST the EXACT language path (locale, arch, OS) before serving non-English; don't assume the
  English tokenizer/fuzzy behavior generalizes. Choose engines/configs with proven support for your languages.

### P24 — Recommending a search/RAG OSS repo on STAR COUNT (stars ≠ current)
- **Breaks:** High stars ≠ active maintenance — `oramasearch/orama` (10,413★) was last pushed Feb 2026 vs the
  weekly-shipping engines; demo repos (typesense showcase apps, last push ~1yr) are stable demos, not live
  core. Source: `ecosystem-01` §3 (selection heuristics).
- **Detect:** A repo recommended on stars alone; `pushed_at` is stale relative to the fast-moving engines.
- **Avoid:** Weight `pushed_at` heavily, not stars — prefer the vendor's own maintained example/adapter +
  THIS-WEEK-pushed client repos; flag anything stale >12mo as "demo-grade, not core."

### P25 — Boundary pitfall: truffle wandering into acorn's pgvector DB ownership (or the LLM step)
- **Breaks:** truffle starts "provisioning the Postgres + pgvector database / sizing the box / owning the DB
  schema migrations" — that's **acorn's** turf; or it tries to own the LLM GENERATION step that consumes the
  retrieved chunks — that's downstream. The wasted-time trap. Source: mission boundary; `ecosystem-07` §2.
- **Detect:** The task is "stand up/operate the pgvector DB as infrastructure" or "make the LLM answer better
  from the chunks" — not "get the right chunks ordered correctly."
- **Avoid:** **Place every task on the boundary first.** Embeddings STORAGE / the pgvector DB = acorn (cite,
  don't duplicate). The LLM generation = downstream. truffle keeps the RETRIEVAL layer: the engine, the hybrid
  query, the fusion, the relevance tuning, the reranker, the iterative-scan setting, the eval loop, faceting,
  typo tolerance, multi-tenancy. "truffle = the query and the ranking; acorn = the box the vectors sit in."
