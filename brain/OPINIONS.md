---
title: "truffle OPINIONS — the taste layer (always X / never Y, because Z)"
type: synthesis
domain: search
created: 2026-06-17
updated: 2026-06-17
tags: [opinions, taste, anti-slop, search, hybrid-search, bm25, vector, reranking, relevance, faceting, truffle, cp123]
sources: ["brain/research/raw/ecosystem-04-embeddings-reranking-rag.md", "brain/research/raw/ecosystem-05-agent-operator-clis-mcps.md", "brain/research/raw/ecosystem-06-tradeoff-matrix.md", "brain/research/raw/ecosystem-07-internal-bm25-vs-real-search.md", "brain/research/raw/ecosystem-00-versions-and-changelogs.md", "brain/research/raw/ecosystem-02-docs-deep-dive-flows.md", "brain/research/raw/ecosystem-09-es-opensearch-minor-deltas.md", "brain/research/raw/field-01-hybrid-beats-vector-and-relevance-hell.md", "brain/research/raw/field-02-faceting-at-scale-and-migration-war-stories.md", "brain/research/raw/field-03-elasticsearch-ops-nightmares.md", "brain/research/raw/field-04-explicit-taste-from-great-practitioners.md", "brain/research/raw/field-05-version-gotchas-disputes-and-2026-shifts.md"]
related: ["[[truffle EXPERTISE-MAP]]", "[[truffle KNOWN-PITFALLS]]", "[[truffle BATTLE-TESTED-SCENARIOS]]", "[[truffle GAPS-AND-DISPUTES]]"]
summary: "Explicit, defensible taste stances — what truffle ALWAYS does and NEVER does, each with a reason and a source. The anti-slop layer that makes truffle opinionated, not a Wikipedia summary of search engines. Where a stance is contested, it's flagged and the dispute lives in GAPS-AND-DISPUTES."
---

# truffle OPINIONS

> These are stances, not summaries. Each is "**ALWAYS / NEVER X — because Z**" with a source. truffle holds
> these by default and will defend them; where a stance is contested, it's flagged and the dispute lives in
> [[truffle GAPS-AND-DISPUTES]]. Taste is what separates a domain expert from a search engine.

---

## On the boundary (the first thing truffle gets right)

**O1. ALWAYS place a task on the retrieval↔storage boundary before doing anything; NEVER duplicate acorn's
pgvector DB ownership.**
Because the real split is **retrieval/relevance (truffle) vs the vector STORAGE substrate (acorn's pgvector
DB)** — truffle owns the query, the hybrid fusion, the relevance tuning, the reranker, the iterative-scan
setting, faceting, typo tolerance, multi-tenancy, and the eval loop; acorn owns provisioning/operating the
Postgres+pgvector box. "truffle = the query and the ranking; acorn = the box the vectors sit in." truffle also
does NOT own the LLM generation step that consumes the top-8 chunks. Source: mission boundary; `ecosystem-07`
§2.

**O2. NEVER over-correct and rip out a good in-house BM25 for a tiny offline corpus; ALWAYS apply the litmus
test.**
Because `sentinel/brain_search.py` is a textbook-correct Okapi BM25 (k1=1.5, b=0.75) and its "free,
deterministic, offline, no quota, instant" pitch is CORRECT for a few hundred notes — standing up a server is
pure overhead. The litmus test: *"Does a human end-user type queries expecting typo-tolerant, faceted,
relevance-ranked results?"* → truffle. *"Is it an agent grepping its own notes offline?"* → keep the in-house
BM25. truffle supersedes the in-house layers only for product/multi-tenant/large/quality-visible surfaces.
Source: `ecosystem-07` §3.

## On hybrid + the 2026 retrieval consensus

**O3. ALWAYS go hybrid (BM25 + vector + fusion); NEVER ship pure vector search and call it "better."**
Because pure vector LOST the "which is better" war — on real e-commerce data (WANDS) pure KNN (~0.6953 NDCG)
LOSES to BM25 (~0.6983), and hybrid beats both. The failure modes are complementary: BM25 wins
exact/rare/IDs/codes/SKUs/out-of-domain jargon, vectors win paraphrase/synonyms. "It's now entirely about how
precisely you understand where each one fails." Source: `field-01` §1/§2.

**O4. ALWAYS test the lexically-specific query class (codes, SKUs, API names, IDs); NEVER ship on
paraphrase-query demos alone.**
Because a demo that nails "find docs about authentication" can completely fail "find docs mentioning
`0x80070005`" — dense embeddings treat error codes as noise, cluster near-identical SKUs (`RTX-4090` vs
`RTX-4070`), and average away rare-entity signal. The lexical class is exactly where the silent failures live.
Source: `field-01` §1.

**O5. ALWAYS treat RRF as the FLOOR; NEVER stop at RRF and call relevance done.**
Because naive RRF is only +1.3% over BM25 on WANDS; the real lift (+7.5%) comes from tier/boost tuning ON TOP
of fusion. "Naive RRF significantly undersells what properly tuned hybrid can achieve." Average engineers ship
RRF and stop; great ones tune the tiers (gated on a golden set). Source: `field-01` §2. (Contested for "good
enough RAG grounding" — see [[truffle GAPS-AND-DISPUTES]] DISPUTE B.)

**O6. ALWAYS add a reranker as the biggest single quality lever; NEVER bolt it onto everything.**
Because a cross-encoder rerank of the top-100 is usually the biggest single jump (+5-15 NDCG@10, +20-35% RAG
accuracy, 72% LLM-cost reduction) — if you can do ONE thing to a hybrid pipeline, add it. BUT skip it when (a)
latency can't absorb +100-500ms (autocomplete) or (b) bi-encoder MRR@5 already > 0.85 — reranking a
near-perfect set is pure latency cost. Source: `ecosystem-04` §2; `field-04` §3a/§3b.

## On embeddings

**O7. ALWAYS start with the boring default embedder and MEASURE; NEVER fine-tune embeddings as the first
lever.**
Because the instinct to fine-tune early is premature optimization. Start with 3-small or BGE-large, eval on a
domain golden set, get the cheaper+bigger lift from fusion+rerank first, and ONLY fine-tune (+10-30% in
specialized domains) when a MEASURED gap remains and the business case justifies it. Source: `field-04` §2b.

**O8. NEVER pick an embedding (or reranker) model by MTEB/leaderboard rank; ALWAYS eval on YOUR golden set.**
Because MTEB is a PRIOR, not an oracle — the MTEB top-3 ranked 5th/7th/2nd on a real legal corpus and an
MTEB-#11 model won; a 5-pt MTEB gap ≈ 3-8% real recall@10; models tuned ON MTEB overfit. Use the leaderboard to
SHORTLIST, then your 200-query golden set decides. Same for reranker vendor benchmarks. Source: `field-04` §2a;
`ecosystem-04` §1.

**O9. ALWAYS keep embedding dims within the index cap; NEVER assume the biggest model is usable.**
Because pgvector HNSW caps at 2,000 dims (4,000 halfvec), so OpenAI 3-large at 3,072 can't be ANN-indexed
unless you Matryoshka-truncate — and dims drive the vector-DB bill (1024-dim float32 = 4KB/vector → 10M = 40GB)
far more than the embedding API bill. Pick dims for indexability AND cost. Source: `ecosystem-04` §1;
`ecosystem-03` §3 (#461).

**O10. In 2026, closed-vs-open embeddings/rerankers is a COMPLIANCE decision, not a quality one.**
Because open models (BGE/Jina/Nomic) now match closed on retrieval quality across most domains — the decision
axis moved to data-residency/ZDR/cost/self-host. Picking closed "for quality" is a 2023 reflex; on a GPU, open
rerankers match API latency at zero marginal cost. Source: `field-04` §2c/§3c.

## On the engine choice

**O11. ALWAYS answer the corpus-size/control routing question BEFORE naming an engine; NEVER conflate "search
platform" with "search box."**
Because most engine "disputes" dissolve once you separate them: a product needs a good search box fast (→
Meili/Typesense/PG); an enterprise needs max relevance control + analytics + scale (→ ES/OpenSearch). The
litmus question routes the whole decision. Source: `ecosystem-07` §3; `field-01` §4 (Dispute A synthesis).

**O12. Default to Meilisearch for the turnkey/agent-native path; reach for Typesense (latency/multitenancy) or
Postgres ("one fewer service") only for a reason.**
Because Meili has the easiest self-host, best DX, hybrid-on-by-default (2026), and official MCP + official CLI
— the agent-tooling edge. Typesense wins raw latency + the best OSS multi-tenancy (HMAC scoped keys) + cleanest
hybrid API but has NO official MCP/CLI and is RAM-bound. Postgres+pgvector ("one fewer service", acorn's DB) is
the most agent-legible (SQL) but you hand-roll fusion. Source: `ecosystem-06` §3; `ecosystem-05` §6.
(Contested default — see [[truffle GAPS-AND-DISPUTES]] DISPUTE C.)

**O13. NEVER default to Elasticsearch for a product search box; ALWAYS right-size.**
Because ES is over-provisioned for the 90% of search that is a product search box — the 10-issue ops catalog
(GC pauses, mapping explosion, shard guesswork, the 10K deep-pagination cliff, split-brain, 16-64GB RAM/node)
only earns its weight at petabyte scale / logs+search-in-one / heavy aggregations. The mistake average teams
make is reaching for ES by default (resume-driven) and drowning for a corpus that fits in RAM on one box.
Source: `field-03` §2/§4.

**O14. NEVER cite the license as a reason to leave ES in 2026; the current reasons are OPS + COST.**
Because ES is **AGPL again** (the 2021 SSPL fear is over) and OpenSearch is Apache-2 + Linux-Foundation-
governed — the license war cooled. "We left ES over licensing" is a 2021-era reason; the real 2026 reasons are
operational weight (`field-03`) and cost. Source: `ecosystem-00` §6.5; `field-03` §5.

**O15. NEVER default an agent product to Algolia; ALWAYS prefer flat-cost self-host for high-internal-query
workloads.**
Because Algolia bills per-query AND per-record — the WORST possible fit for an agent that queries thousands of
times per task — and "bill shock at ~1M+ records" is the canonical migration trigger. Algolia is right ONLY
when relevance is revenue-critical (e-commerce) + budget > engineering time. Source: `field-02` §4;
`ecosystem-06` §3.

## On faceting + relevance tuning

**O16. ALWAYS treat faceting as a SYSTEMS problem with cost dials; NEVER ship "GROUP BY + COUNT" faceting.**
Because turning on ONE high-cardinality facet collapsed a real ES cluster 400 → 20-30 QPS (the global-ordinals
tax). The real model is a single-pass over the matched set with cardinality, count-cap ("500+"),
`terminate_after`/sampling, MVCC-correctness, and multi-select exclusion all as cost dials (the Vinted
playbook). Source: `field-02` §1/§2.

**O17. ALWAYS make pragmatic correctness-vs-performance facet tradeoffs explicitly; NEVER pretend exact counts
at scale are free.**
Because Vinted deliberately capped counts at "500+", reduced cardinality 2M→40K (~15ms P99), and even accepted
slightly-wrong counts (counting banned users) for a 5% cache-hit gain. Typesense added facet SAMPLING
(approximate counts) for 100K+ matched docs. Great search engineers make these calls deliberately; average ones
ship the naive O(cardinality) version that dies. Source: `field-02` §1; `field-05` §2.

**O18. ALWAYS gate every relevance change behind a corpus-wide eval set; NEVER tune for a "pet" query.**
Because "the biggest trap people fall into is tuning for one or a few 'pet' queries" — a fix for one query "can
have cascading effects downstream that mess up the bulk of your other queries." Relevance is a GLOBAL
optimization; local fixes cause silent global regressions. Source: `field-01` §3; `field-04` §1c.

**O19. ALWAYS treat "search is never done" as an architectural requirement; NEVER ship a one-shot index.**
Because "good search looks effortless; it's the most expensive feature to maintain" — it needs (a) a golden
eval set, (b) per-query regression, (c) a continuous tuning loop. This IS the AutoLab/observer loop applied to
search (sentinel/darwin). Source: `field-01` §3.

## On version discipline + operating as an agent

**O20. NEVER treat a search-engine version bump as a no-op; ALWAYS re-run the regression suite first.**
Because the fast OSS engines move quickly and occasionally REGRESS core behavior — Typesense v28 SILENTLY broke
typo tolerance (#2313, raising the params didn't help), v28 hybrid+`symbols_to_index` broke scoring (#2365) —
and change internals that DON'T auto-migrate (Meili arroy→hannoy, delta-bitmap #5985). After ANY upgrade,
re-run the typo + hybrid-scoring golden tests before shipping; plan a reindex for internal changes; pin the
prior version if a minor regresses. Source: `field-05` §1.

**O21. ALWAYS discover capability via MCP first; ALWAYS treat Meili writes as async + poll the task queue.**
Because Meili/ES/OpenSearch/Algolia ship official MCPs (Postgres via `psql`/SQL is the most agent-legible),
while Typesense has NONE — and Meili writes return a `taskUid` and are QUEUED, so an agent that doesn't poll
`/tasks` will query docs that aren't searchable yet. (Typesense sync but `HTTP 503` under bulk; ES
`refresh=wait_for`.) Source: `ecosystem-05` §1/§5.

**O22. ALWAYS verify filtered-ANN before applying stage-1 filters; NEVER assume the vector store handles it.**
Because pgvector < 0.8 silently under-returns (fewer than LIMIT) under a selective filter (#259) — fixed by
≥0.8 + `hnsw.iterative_scan`. Apply metadata filters at retrieval, but VERIFY the engine/version handles
filtered-ANN, or you ship a search that quietly drops valid results. (The DB is acorn's; the iterative-scan
setting is truffle's.) Source: `ecosystem-04` §4; `ecosystem-03` §3.

**O23. ALWAYS isolate tenants with a server-enforced primitive; NEVER put the tenant filter only in the client
query.**
Because a client-side `filter_by: company_id:X` is trivially bypassable. Use Typesense HMAC scoped keys (the
best OSS option — the filter is baked into a signed key), Meili tenant tokens, ES index/alias or doc-level
security, or Postgres RLS. Source: `ecosystem-02` §1e.

**O24. NEVER recommend a search/RAG OSS repo on STAR COUNT; ALWAYS weight `pushed_at`.**
Because high stars ≠ active maintenance for a fast-moving field — `oramasearch/orama` (10,413★) last pushed
Feb 2026 vs the weekly-shipping engines; the Typesense showcase apps are stable demos (~1yr), not live core.
Prefer the vendor's own maintained adapter + THIS-WEEK-pushed client repos. (Stars ≠ current.) Source:
`ecosystem-01` §3.

**O25. ALWAYS test the exact non-latin/CJK path before serving it; NEVER assume the English tokenizer
generalizes.**
Because CJK/non-latin tokenization is every engine's weak spot — Typesense crashes on `locale: ja` (ARM64
Docker #1002), ParadeDB non-latin fuzzy is weak (#3782), Meili tokenizer issues. Test the exact locale/arch/OS
before serving non-English. Source: `ecosystem-03` §1/§5.

---

## The truffle spine (the five stances that subsume the rest)

1. **Retrieval/relevance → truffle; the pgvector DB → acorn; the LLM generation → downstream.** Place every
   task on that boundary first; don't over-correct and replace a good in-house BM25 for a tiny offline corpus.
   (O1, O2)
2. **Hybrid (BM25 + vector + RRF) + a reranker is the 2026 default.** Pure vector lost; RRF is the floor not
   the finish (tune the tiers); the reranker is the biggest single lever (except when latency/MRR says skip).
   (O3, O4, O5, O6)
3. **MTEB is a prior not an oracle; eval on YOUR golden set; search is never done.** Boring default → measure →
   fuse+rerank → fine-tune last; gate every relevance change behind a corpus-wide eval. (O7, O8, O18, O19)
4. **Right-size the engine; answer corpus-size/control first.** Meili default (turnkey+agent-native),
   Typesense for latency/multitenancy, Postgres for "one fewer service", ES/OpenSearch only at scale, Algolia
   only when relevance is revenue-critical + budget > eng. (O11, O12, O13, O15)
5. **Version discipline + agent hygiene.** Never treat a bump as a no-op (re-run the regression suite); MCP
   first; Meili writes are async (poll tasks); verify filtered-ANN; server-enforced multi-tenancy. (O20, O21,
   O22, O23)
