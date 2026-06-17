---
title: "truffle BATTLE-TESTED-SCENARIOS — real failure/migration/production scenarios + resolutions"
type: synthesis
domain: search
created: 2026-06-17
updated: 2026-06-17
tags: [scenarios, golden-tasks, eval, hybrid-search, faceting, filtered-ann, typo-tolerance, migration, version-bump, truffle, cp123]
sources: ["brain/research/raw/ecosystem-03-github-issues-real-breakage.md", "brain/research/raw/ecosystem-04-embeddings-reranking-rag.md", "brain/research/raw/ecosystem-05-agent-operator-clis-mcps.md", "brain/research/raw/ecosystem-02-docs-deep-dive-flows.md", "brain/research/raw/ecosystem-06-tradeoff-matrix.md", "brain/research/raw/ecosystem-07-internal-bm25-vs-real-search.md", "brain/research/raw/field-01-hybrid-beats-vector-and-relevance-hell.md", "brain/research/raw/field-02-faceting-at-scale-and-migration-war-stories.md", "brain/research/raw/field-03-elasticsearch-ops-nightmares.md", "brain/research/raw/field-05-version-gotchas-disputes-and-2026-shifts.md"]
related: ["[[truffle EXPERTISE-MAP]]", "[[truffle KNOWN-PITFALLS]]", "[[truffle OPINIONS]]", "[[truffle TOOL-MATRIX]]"]
summary: "16 real, specific search/retrieval/relevance scenarios (sourced from GitHub issues, engineering postmortems, migration guides, and practitioner taste) — each with situation, the trap, the resolution, and the eval-gate. These become golden eval tasks in Wave S: a fresh truffle session should resolve each one the right way at June-2026 SOTA."
---

# truffle BATTLE-TESTED-SCENARIOS

> Each scenario is a real or realistic situation a Search employee hits, drawn from the research's anti-slop
> layer (GitHub issues ranked by reactions/comments, engineering postmortems, vendor migration guides,
> practitioner taste) + the Energy in-house baseline. Format: **Situation → The trap → Resolution → Eval
> gate.** The eval gate is what a Wave-S golden task checks. These are the difference between "knows the
> vocabulary" and "ships search that silently returns the wrong results."

---

## S1 — Pure vector search silently fails on the queries that matter (codes, SKUs, API names)

- **Situation:** A team builds semantic-only search over technical content (docs with error codes, product
  SKUs, function names). It nails "find docs about authentication" in the demo. In production, "find docs
  mentioning `0x80070005`" and "`RTX-4090` vs `RTX-4070`" return plausible-but-wrong results. Source:
  `field-01` §1.
- **The trap:** Believing "semantic search is strictly better than keyword." Dense embeddings treat error
  codes/identifiers as noise, cluster near-identical SKUs together, and "average away" a rare term's signal in
  the pooled embedding. The demo's natural-language queries hid the failure class. Source: `field-01` §1.
- **Resolution:** Go **hybrid (BM25 + vector, fused with RRF)** — BM25 wins exact/rare/ID/out-of-domain
  lookups, vectors win paraphrase/synonyms; their failure modes are complementary. Test against the
  LEXICALLY-SPECIFIC query class (codes, SKUs, API names, IDs), not just paraphrase. On real e-commerce data
  (WANDS) pure KNN (~0.6953 NDCG) actually LOSES to BM25 (~0.6983); hybrid beats both. Source: `field-01`
  §1/§2; `ecosystem-04` §3.
- **Eval gate:** Given a "semantic search is enough" pitch over code/SKU content, the agent insists on hybrid,
  names the dense-failure classes (codes/SKUs/API-names/rare-entities), and adds a lexical-query test set — does
  NOT say "just use embeddings."

## S2 — Algolia bill shock at ~1M+ records drives a migration the team didn't budget for

- **Situation:** A product on Algolia grows past ~1M records; the monthly bill jumps from hundreds to
  thousands of dollars (Algolia bills on BOTH search requests AND records stored). Leadership wants off.
  Source: `field-02` §4; `ecosystem-06` §1.
- **The trap:** Two traps: (a) treating the migration as a drop-in (it's NOT wire-compatible — every line
  touching the search API gets rewritten); (b) assuming "we'll just self-host and save money" with no
  accounting for the rebuild — Algolia's A/B testing, personalization, recommendations, and analytics do NOT
  migrate; that's a rebuild, not a migration. Source: `field-02` §3/§4.
- **Resolution:** Default the high-internal-query agent product to **flat-cost self-host (Meilisearch/Typesense)
  or Postgres** — per-query pricing is the WORST fit for an agent that queries thousands of times per task. For
  the Algolia→Typesense path: reuse the InstantSearch adapter for the UI (30 min–1 hour), but budget 2-3 weeks
  for the DATA + features layer; fix the concrete breakages (objectId→id, ISO8601→Unix-epoch timestamps,
  consistent types via `coerce_or_reject`, 503-backoff on bulk import); and explicitly price the rebuild of
  A/B + personalization. The honest framing: "Algolia is expensive but you pay someone to run+tune it;
  self-host is cheap but YOU now own relevance, ops, and the features Algolia gave you free." Source:
  `field-02` §3/§4; `ecosystem-06` §3.
- **Eval gate:** The agent recommends flat-cost self-host for the agent use case, enumerates the real
  migration breakages (type strictness, timestamp format, objectId, 503-backoff), AND flags the
  A/B/personalization rebuild as a hidden cost — does not call it a "drop-in."

## S3 — The team ships RRF hybrid and stops, leaving most of the quality on the table

- **Situation:** An engineer implements hybrid search with RRF, sees it beat both BM25 and pure vector, and
  ships it as "done." Source: `field-01` §2.
- **The trap:** Treating RRF as the finish line. On WANDS, naive RRF is only **+1.3% over BM25**; the real
  lift — **+7.5%** — comes from tier/boost tuning ON TOP of fusion (boost all-term-match 100×, any-term 10×,
  vector fallback 0.1×). "RRF is enough" leaves most of the achievable relevance unrealized. Source: `field-01`
  §2/§4 (Dispute B).
- **Resolution:** Ship RRF as the FLOOR, then tune tiered boosting if relevance is revenue-critical. Measure
  against a golden set targeting Recall@10 = 85–91%, MRR > 0.80, Hit Rate@10 > 90% on YOUR corpus; if below,
  there's tuning work. (If relevance is only "good enough for RAG grounding," RRF + a reranker is fine — the
  honest answer depends on whether relevance is revenue-critical.) Source: `field-01` §2/§4.
- **Eval gate:** Given "we shipped RRF, we're done," the agent says RRF is the floor not the finish, cites the
  +7.5%-vs-+1.3% gap, and proposes tiered tuning gated on a golden-set metric — for a revenue-critical surface.

## S4 — Filtered vector search silently returns FEWER than LIMIT rows (the pgvector trap)

- **Situation:** A team runs pgvector ANN with a metadata filter (`WHERE category_id = 5 ORDER BY embedding
  <=> $1 LIMIT 10`). For selective filters they get back 3 rows instead of 10 — silently. Source: `ecosystem-03`
  §3 (#259).
- **The trap:** Not knowing that an HNSW/IVFFlat ANN returns the top-K nearest vectors, and a post-filter then
  prunes those K — so the matching rows can lie outside the ANN's explored neighborhood and you under-return,
  with no error. Before pgvector 0.8 this was a real correctness bug (the canonical #259 thread, 61👍/87💬,
  maintainers jkatz + ankane). Source: `ecosystem-03` §3.
- **Resolution:** Use **pgvector ≥ 0.8.0** and enable **iterative index scans** (`SET hnsw.iterative_scan =
  'relaxed_order'` or `'strict_order'`) — Postgres re-probes the index (relaxing radius) until it reaches
  LIMIT. This is the single most important correctness fix for "vector search in my existing Postgres." Verify
  ANY engine handles filtered-ANN before applying stage-1 filters. **(The pgvector DB itself is acorn's
  substrate; the iterative-scan setting + the filtered-retrieval semantics are truffle's.)** Source:
  `ecosystem-03` §3; `ecosystem-04` §4; mission boundary.
- **Eval gate:** Given filtered vector search returning too few rows, the agent names the filtered-ANN
  under-return class, prescribes pgvector ≥0.8 + iterative scans, and says to verify the engine/version handles
  it — does NOT say "increase LIMIT" or "remove the filter."

## S5 — Turning on ONE high-cardinality facet collapses throughput 13-20×

- **Situation:** A team adds a facet on a high-cardinality field (tags, brand) to their ES-backed search. QPS
  drops from 400 to 20-30 and average latency jumps 40ms → 500ms. Source: `field-02` §2.
- **The trap:** Believing "faceting is just GROUP BY + COUNT." On ES, high-cardinality terms aggs are slow and
  unpredictable because of the **global-ordinals tax** (a per-shard numbering of every unique term, rebuilt as
  data changes). Faceting is a CPU-vs-latency-vs-disk-vs-cache-vs-correctness systems problem, not a query
  problem. Source: `field-02` §2.
- **Resolution:** Apply the scale dials (the Vinted playbook): **reduce cardinality** (2M → 40K verified
  brands dropped P99 ~15ms), **cap counts ("500+")**, `terminate_after` (100K docs/shard), `size: 0` for
  aggregation-only requests, dynamic caching by result-set size; on Typesense use **facet sampling**
  (`facet_sample_threshold: 100000`, `facet_sample_percent: 10` → estimate from 10% of hits) for facets over
  100K+ matched docs. Accept approximate counts as a deliberate tradeoff. Source: `field-02` §1/§2; `field-05`
  §2 (#914).
- **Eval gate:** The agent treats faceting as a systems problem, prescribes cardinality reduction + count caps
  + `terminate_after`/sampling, and frames approximate counts as a tradeoff — does not say "just add the
  facet."

## S6 — A reranker is bolted onto everything, adding latency where it buys nothing

- **Situation:** A team adds a cross-encoder reranker to every search surface, including a sub-100ms
  autocomplete and a small-corpus lookup where stage-1 already returns near-perfect top-5. Source: `field-04`
  §3b.
- **The trap:** Treating the reranker as a universal good. It adds +200-500ms per query (≈100ms on GPU) — fatal
  for autocomplete — and reranking an already-good candidate set (bi-encoder MRR@5 > 0.85) is pure latency cost
  for no gain. Source: `field-04` §3b.
- **Resolution:** Add a reranker where it earns its latency (ambiguous/long-tail/multi-hop queries,
  precision-critical retrieval, RAG where you pay per retrieved token) — there it's the biggest single lever
  (+5-15 NDCG@10, +20-35% RAG accuracy, 72% LLM-cost reduction). **SKIP it** when (a) latency can't absorb
  +100-500ms or (b) MRR@5 already > 0.85. Pick bge-reranker-large v2 on GPU (zero marginal cost, matches API
  latency), or Cohere rerank-3.5 for the managed SLA. Source: `field-04` §3a/§3b/§3c; `ecosystem-04` §2.
- **Eval gate:** The agent adds a reranker to the right surfaces and explicitly declines it for autocomplete /
  already-good retrieval, citing the latency budget and the MRR@5 > 0.85 rule.

## S7 — Multi-tenant search leaks across tenants because the filter lived in the client query

- **Situation:** A multi-tenant SaaS scopes search results by sending `filter_by: company_id:124` from the
  frontend. A user edits the request and reads another tenant's data. Source: `ecosystem-02` §1e.
- **The trap:** Putting the tenant filter only in the client-side query — it's trivially bypassable. There is
  no server-enforced isolation. Source: `ecosystem-02` §1e.
- **Resolution:** Use the engine's cryptographic/server-enforced primitive. **Typesense HMAC scoped keys** are
  the best OSS option: bake the `filter_by` (`company_id:124`) into an HMAC-signed search key so the tenant
  filter CANNOT be bypassed client-side; role-based variants
  (`accessible_to_organization_id:=1 && accessible_to_roles:=[...]`) work too; revoking the parent key
  invalidates all derived scoped keys. Alternatives: Meili tenant tokens (JWT), ES index/alias or
  document-level security, Postgres row-level security. Source: `ecosystem-02` §1e; `ecosystem-06` §1.
- **Eval gate:** The agent rejects the client-side tenant filter, reaches for a server-enforced primitive
  (scoped key / tenant token / RLS), and notes parent-key revocation cascades to scoped keys.

## S8 — A "safe" version bump silently regressed typo tolerance (Typesense v28)

- **Situation:** A team upgrades Typesense to v28; afterward, even the smallest typos ("d" instead of "t")
  return ZERO matches, where they were handled correctly before. Bumping the typo-tolerance parameters makes no
  difference. (Real: Typesense #2313, 2025-04-24, OPEN.) Source: `field-05` §1a.
- **The trap:** Treating a search-engine minor-version bump as a no-op. Typo tolerance is THE headline feature
  vs Elasticsearch, and a "safe" upgrade quietly degraded the core UX with NO error — and the obvious fix
  (raise the typo params) didn't work. Source: `field-05` §1a.
- **Resolution:** **NEVER treat a search-engine version bump as a no-op.** After ANY upgrade, re-run the
  typo-tolerance golden tests (single-char substitution, transposition, multi-word typo) and hybrid-scoring
  tests BEFORE shipping. This is the concrete justification for the "search is never done" version-bump
  regression suite being built into the harness. If a minor regresses a core behavior, pin the prior version
  and file/track the issue. Source: `field-05` §1a/§1 (meta-pattern); `field-01` §3.
- **Eval gate:** Given a post-upgrade typo-tolerance regression, the agent attributes it to the version bump
  (not config), prescribes a regression suite run before shipping + pinning the prior version, and does NOT
  just keep raising the typo params.

## S9 — Meili docs aren't searchable right after indexing (the async-write surprise)

- **Situation:** An agent POSTs documents to Meilisearch and immediately queries them — and finds nothing.
  Under sustained writes the task queue backs up 30-50 minutes (issue #1098). Source: `ecosystem-02` §2d;
  `ecosystem-03` §1 (#1098); `ecosystem-05` §5.
- **The trap:** Assuming writes are synchronous. EVERY Meili write (add docs, update settings, configure
  embedder) returns a `{ taskUid }` and is QUEUED — docs are NOT searchable until the task finishes, and under
  load the INDEXER is the bottleneck, not query latency. Source: `ecosystem-02` §2d.
- **Resolution:** Treat Meili indexing as **eventually-consistent**: poll `GET /tasks/{uid}` until `status:
  "succeeded"` before assuming searchability; monitor the task-queue depth + disk trend, not just query p99.
  (Typesense/Postgres are synchronous; ES use `refresh=wait_for`; Typesense returns `HTTP 503` under heavy bulk
  → retry with backoff.) Source: `ecosystem-02` §2d; `ecosystem-05` §5; `field-02` §3.
- **Eval gate:** The agent polls the task queue before relying on new docs, monitors queue depth, and knows the
  per-engine write model (Meili async / Typesense sync+503 / ES `refresh=wait_for`).

## S10 — A 20MB dataset crashes a 14GB Elasticsearch cluster (mapping explosion)

- **Situation:** A 20MB dataset repeatedly crashes a 14GB ES cluster (forcing reboots) even though the team
  "followed best practices." The 15-type YAML mapping ballooned to 16,000+ lines of ES JSON. Source: `field-03`
  §1.
- **The trap:** The wrong mental model that `not_analyzed` means "not indexed" — it doesn't; the field is still
  used to create indices. Unmapped nested object properties auto-generated a mapping per nested field; heap grew
  disproportionate to data, hit the 75% GC trigger → 99% heap → timeouts + data loss. Source: `field-03` §1.
- **Resolution:** **Never leave dynamic mapping unbounded.** Declare schema explicitly (index projections
  mapping ONLY necessary fields), flatten the structure, use `enabled: false` on rehydration-only object fields
  (so they're not analyzed AND not indexed), and set `index.mapping.total_fields.limit`. An agent that lets ES
  auto-map arbitrary JSON WILL eventually explode the cluster state (the same class hits logging clusters when
  log values become field names). Source: `field-03` §1/§3.
- **Eval gate:** The agent corrects the `not_analyzed` ≠ "not indexed" misconception, prescribes explicit
  mapping + `enabled: false` + a total-fields limit, and never recommends unbounded dynamic mapping.

## S11 — Picking the embedding model off the MTEB leaderboard, and it loses on the real corpus

- **Situation:** A team picks the MTEB top-ranked embedding model for a legal-contract retrieval system. On
  their own 200-query eval set, the MTEB top-3 rank 5th/7th/2nd, and the WINNER is an MTEB-#11 model
  (BGE-large-en-v1.5). Source: `field-04` §2a; `ecosystem-04` §1.
- **The trap:** Sorting the MTEB leaderboard descending and picking #1. MTEB is gameable/overfit; a 5-pt MTEB
  gap ≈ only 3-8% real recall@10; leaderboard rank ≠ your rank on your domain. Source: `field-04` §2a;
  `ecosystem-04` §1.
- **Resolution:** Treat **MTEB as a SHORTLIST generator, not a decision oracle.** Start with a boring default
  (3-small or BGE-large), eval the shortlist on YOUR 200-query golden set, and only fine-tune embeddings
  (+10-30% in specialized domains) as the LAST lever after fusion+rerank (which are cheaper and bigger). In
  2026, closed-vs-open is a compliance/ops decision, not a quality one. Source: `field-04` §2a/§2b/§2c.
- **Eval gate:** The agent uses MTEB to shortlist, insists on a domain golden-set eval, and treats fine-tuning
  as the last lever — does NOT pick the embedder by leaderboard rank alone.

## S12 — Tuning relevance for the loudest stakeholder's "pet query" breaks 1,000 silent queries

- **Situation:** A stakeholder complains one query ranks wrong. An engineer tweaks the ranking function to
  perfect that query and ships it. Other queries' relevance quietly degrades. Source: `field-01` §3; `field-04`
  §1c.
- **The trap:** The relevance-whack-a-mole law: "The biggest trap people fall into is tuning for one or a few
  'pet' queries" — a fix for one query "can have cascading effects downstream that mess up the bulk of your
  other queries." Relevance is a GLOBAL optimization; local fixes cause silent global regressions. Source:
  `field-01` §3; `field-04` §1c.
- **Resolution:** Gate EVERY relevance change behind a corpus-wide golden-query eval set with per-query
  regression — so a fix for query A can't silently break B–Z. Ship the eval loop, not just the index; this is
  the AutoLab/observer loop (sentinel/darwin) applied to search. "Good search looks effortless; it's the most
  expensive feature to maintain." Source: `field-01` §3; `field-04` §1c.
- **Eval gate:** The agent refuses to ship a pet-query fix without a corpus-wide regression check, and proposes
  a golden-set + per-query regression as the gate.

## S13 — Reaching for Elasticsearch BY DEFAULT for a corpus that fits in RAM on one box

- **Situation:** A team building a simple product search box reaches for Elasticsearch because "it's the
  standard," then drowns in JVM GC pauses, shard-sizing guesswork, split-brain risk, deep-pagination limits,
  and 16-64GB-RAM/node infra cost — for a corpus that would fit in RAM on a single Meilisearch box. Source:
  `field-03` §2/§4.
- **The trap:** Resume-driven / "it's the standard" engine selection. ES is over-provisioned for the 90% of
  search that is a product search box; its complexity is justified only at genuine web scale. Source: `field-03`
  §4.
- **Resolution:** **Right-size.** Reserve ES/OpenSearch for petabyte scale, logs+search-in-one, or heavy
  aggregations; reach for Meilisearch/Typesense/Postgres for a typical product search box (Meili delivers
  sub-50ms on one well-optimized server). Answer the corpus-size/control routing question FIRST. (The 2021
  license fear is gone — ES is AGPL again — so "we left ES over licensing" is a dead reason; current reasons are
  OPS + COST.) Source: `field-03` §4/§5; `ecosystem-06` §3.
- **Eval gate:** Given a simple search box on a small-mid corpus, the agent recommends Meili/Typesense/Postgres
  over ES, justifies it on right-sizing (not license), and reserves ES for genuine scale/analytics.

## S14 — OpenAI 3-large at 3072 dims can't be HNSW-indexed (the dims-vs-index-cap wall)

- **Situation:** A team picks OpenAI `text-embedding-3-large` (3,072 dims) for quality, then can't build an
  HNSW index on pgvector — the index caps at 2,000 dimensions. Source: `ecosystem-03` §3 (#461); `ecosystem-04`
  §1.
- **The trap:** Not knowing pgvector's **HNSW/IVFFlat index cap is 2,000 dims (4,000 with halfvec)** even
  though the column type allows 16,000. So a 3,072-dim embedder can't be indexed directly — your "best quality"
  choice can't be used with an ANN index. Source: `ecosystem-03` §3.
- **Resolution:** Pick embedding dims **≤ 2,000** (or ≤ 4,000 with `halfvec`) if you want an index, OR use
  **Matryoshka truncation** — OpenAI/Cohere expose a `dimensions` param that returns a shorter vector that
  still works (request 1024/512). Remember dims drive the vector-DB bill (1024-dim float32 = 4KB/vector → 10M =
  40GB), so smaller dims help cost AND indexability. Source: `ecosystem-04` §1; `ecosystem-03` §3.
- **Eval gate:** The agent flags the 2,000-dim HNSW cap, prescribes Matryoshka truncation or halfvec, and ties
  dims to both indexability and storage cost — does not just say "use the biggest model."

## S15 — Indexing code/identifiers + hybrid produces wrong scores (the symbols_to_index combo)

- **Situation:** A team indexes technical content where a code reference + a title both matter (the user types
  a reference and expects the record with that reference first). They enable Typesense `symbols_to_index` and
  use hybrid search — the text scores go wrong, highlights are completely off, and `text_match_info` disappears.
  (Real: Typesense #2365, 2025-05-15, OPEN.) Source: `field-05` §1c.
- **The trap:** Assuming the SKU/code/identifier failure class is fully solved by "just index the symbols." It
  hits a SECOND way: even when you correctly try to index symbols, the hybrid score fusion goes wrong — this is
  the lexically-specific query class (S1) breaking at the fusion layer. Source: `field-05` §1c.
- **Resolution:** Test the EXACT code/identifier + hybrid combination explicitly on the target engine/version
  before relying on it; if hybrid scoring is broken for symbol-indexed fields, consider keyword-only (BM25) for
  the code field with a separate vector leg, or pin a version where it works, and track the upstream issue.
  Always re-run the lexical-query + hybrid-scoring golden tests after any version bump (S8). Source: `field-05`
  §1c; `field-01` §1.
- **Eval gate:** The agent recognizes the symbols+hybrid scoring bug as a real combo failure, tests it
  explicitly, and proposes a keyword-leg fallback / version pin rather than assuming "index the symbols, done."

## S16 — Replacing a perfectly-good in-house BM25 with a full search engine for a tiny offline corpus

- **Situation:** Someone wants to rip out `sentinel/brain_search.py` (a correct offline Okapi BM25 over a few
  hundred reel notes) and stand up Meilisearch "because we have a real search employee now." Source:
  `ecosystem-07` §1/§3.
- **The trap:** Over-correcting. `sentinel/brain_search.py` is a textbook-correct BM25 (k1=1.5, b=0.75) and its
  pitch — "FREE, deterministic, offline, no quota, instant" — is CORRECT for a small offline corpus. Standing
  up a server (with RAM, async writes, ops) for an agent grepping its own notes is pure overhead. Source:
  `ecosystem-07` §3.
- **Resolution:** Apply the litmus test: *"Does a human end-user type queries into this, expecting
  typo-tolerant, faceted, relevance-ranked results?"* → real engine (truffle). *"Is it an agent grepping its
  own notes offline?"* → KEEP the in-house BM25. truffle SUPERSEDES the in-house layers only for
  product-facing surfaces, multi-tenant data, thousands+ of docs, or when typo/facets/hybrid/rerank/relevance
  quality is user-visible — NOT for tiny local corpora. (Note: `memory-search.sh` is NOT real BM25 — no IDF,
  no length normalization — so if THAT specific layer's relevance is poor at thousands of files, truffle is the
  right upgrade; the well-written `brain_search.py`/`bm25.ts` are fine to keep.) Source: `ecosystem-07` §1/§3.
- **Eval gate:** The agent applies the litmus test, KEEPS the in-house BM25 for the tiny-offline-corpus case,
  and reserves truffle for product/multi-tenant/large/quality-visible surfaces — does not replace
  `brain_search.py` reflexively.

---

## Coverage map (which JTBD each scenario stresses — for Wave-S eval selection)

| Scenario | Primary JTBD | What it proves |
|---|---|---|
| S1 | JTBD-2 (hybrid) | hybrid beats pure-vector; name the dense-failure classes |
| S2 | JTBD-1 (selection) | Algolia cost-at-scale → flat-cost self-host; migration ≠ drop-in |
| S3 | JTBD-2 (hybrid) | RRF is the floor not the finish; tune the tiers |
| S4 | JTBD-6 (RAG pipeline) | filtered-ANN under-return; pgvector ≥0.8 + iterative scans |
| S5 | JTBD-4 (faceting) | faceting is a systems problem; cardinality/cap/sampling dials |
| S6 | JTBD-3 (reranking) | when NOT to rerank (latency / MRR@5 > 0.85) |
| S7 | JTBD-7 (multi-tenancy) | server-enforced tenant isolation (scoped keys), not client filter |
| S8 | JTBD-8 (version bumps) | a version bump silently regressed typo tolerance; regression suite |
| S9 | JTBD-10 (agent operator) | Meili async writes; poll the task queue |
| S10 | JTBD-9 (ES ops) | mapping explosion; `not_analyzed` ≠ not indexed; bound dynamic mapping |
| S11 | JTBD-3 (embeddings) | MTEB is a prior not an oracle; eval on your golden set |
| S12 | JTBD-5 (relevance tuning) | the pet-query trap; gate every change behind a corpus eval |
| S13 | JTBD-1 / JTBD-9 | right-size; don't reach for ES by default for a small corpus |
| S14 | JTBD-3 (embeddings) | dims-vs-HNSW-cap; Matryoshka truncation / halfvec |
| S15 | JTBD-2 / JTBD-8 | code/identifier + hybrid scoring bug; test the exact combo |
| S16 | JTBD-11 (in-house baseline) | don't over-correct; keep in-house BM25 for tiny offline corpora |
