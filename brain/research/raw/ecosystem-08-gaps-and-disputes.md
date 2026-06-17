---
title: "Search Ecosystem — Gaps, Disputes & Things I Could Not Confirm (June 2026)"
type: synthesis
created: "2026-06-17"
updated: "2026-06-17"
tags: [search, gaps, disputes, uncertainty, methodology]
summary: "Honest ledger of what I could NOT confirm, sources I distrust, and disputes that need a human/follow-up. Read this before treating any single claim in the other files as gospel."
researcher: "truffle ECOSYSTEM (CP123 Wave-R)"
---

# Gaps, Disputes & Could-Not-Confirm Ledger

---

## 1. Things I could NOT confirm (need follow-up)
1. **[RESOLVED 2nd pass]** ~~Exact current Elasticsearch & OpenSearch PATCH versions + their
   last-6-months feature deltas.~~ DONE in **ecosystem-09-es-opensearch-minor-deltas.md**: ES
   v9.4.2 (2026-05-28, 77,048★) + the 9.0→9.4 per-minor arc (BBQ-default → DiskBBQ GA → GPU/cuVS
   GA → multi-bit BBQ + Agent Builder GA), and OpenSearch 3.0→3.5 arc (GPU/cuVS, semantic field,
   star-tree, gRPC, MCP agentic search 3.4, agentic conversation memory + LLM-as-judge 3.5) — all
   GA-vs-preview labeled, dates gh-api-verified, feature deltas from official Elastic/OpenSearch
   sources. RESIDUAL (new gap #7 below): OpenSearch 3.6/3.7 GRANULAR notes still unpinned (dates
   verified, feature markdown not reachable this pass).
2. **pgvector exact current patch + 0.8.x sub-release notes.** Confirmed tags up to v0.8.2 via
   `gh api tags`, and the 0.8.0 iterative-scan fix is solid. Did NOT pin which 0.8.x is "latest
   stable" vs pre-release, nor read 0.8.1/0.8.2 notes. FOLLOW-UP: `gh api repos/pgvector/
   pgvector/releases` returned empty (they tag, don't GitHub-release) — read CHANGELOG.md.
3. **Algolia's exact 2025-26 feature timeline + current pricing tiers.** Algolia is closed +
   SaaS, no semver. I confirmed the MCP launch (June 16, 2025) + NeuralSearch + the two hosted
   MCPs from official pages, but pricing numbers ($500-8,000/mo ranges) come from a
   vendor-adjacent comparison blog, NOT Algolia's pricing page (which gates behind sales).
   Treat pricing as DIRECTIONAL. FOLLOW-UP: get a real Algolia quote or scrape current pricing.
4. **Meilisearch's own Q3-2026 embedder** — announced on the roadmap page (accessed
   2026-06-17) but not shipped as of v1.47. It's a stated plan, not a verified release.
5. **The buildmvpfast Voyage "+14% vs OpenAI" claim** — the page 403'd on WebFetch; I have the
   claim from the firecrawl SEARCH snippet only, and it's on VOYAGE'S OWN RTEB benchmark
   (self-serving). NOT independently verified. The pecollective MTEB table (which I DID fully
   read) shows voyage-3-large 67.1 vs OpenAI 3-large 64.6 — a ~2.5pt MTEB gap, NOT 14%. So the
   "14%" is vendor-bench cherry-picking; the neutral MTEB gap is modest.
6. **Whether Meilisearch official MCP/CLI star counts I cite are the canonical repos** — I
   verified `meilisearch/meilisearch-mcp` (192★) and `meilisearch/meilisearch-cli` exist under
   the official org via `gh api`, but did not audit their feature completeness.
7. **[NEW, 2nd pass] OpenSearch 3.6 (2026-04-07) & 3.7 (2026-06-09) GRANULAR feature deltas.**
   Dates are gh-api-verified, but the 3.6/3.7 release-notes markdown did not resolve via
   WebFetch/search this pass (the opensearch-build path returned only ≤3.5.0). The 3.0→3.5
   trajectory in file 09 is the load-bearing one; 3.6/3.7 are recent minors on top. FOLLOW-UP:
   `gh api repos/opensearch-project/opensearch-build/contents/release-notes/opensearch-release-notes-3.7.0.md`.

## 2. Sources I actively DISTRUST (flagged inline in other files)
- **WebFetch's page-summarizer HALLUCINATED Typesense release dates** (claimed v30 = Jan 2025,
  v28 = Feb 2024 — both off by ~1 year). I caught it by cross-checking `gh api releases` (which
  shows v30.0 = 2026-01-27, v28.0 = 2025-02-18). LESSON: never trust a WebFetch date summary
  for version history; always confirm via `gh api`. All dates in file 00 are gh-api-verified.
- **Vendor comparison blogs** (vibecoder, meilisearch-vs-typesense, typesense-vs-*) — useful
  for FRAMING and stated weaknesses, but their numeric "scores" (Typesense 95% speed, Algolia
  95% relevance) are subjective/marketing-flavored. I labeled them "directional" in file 06.
- **Reranker vendor (ZeroEntropy)** — their "+18% NDCG@10 vs Cohere rerank-3" is on their OWN
  finance benchmark. The cross-encoder architecture facts + the Databricks (+48%) / MIT (+40%)
  cites are neutral; the head-to-head vendor numbers are not.
- **MTEB itself** — every neutral source warns it's gameable/overfit. A 5-pt MTEB gap ≈ 3-8%
  real recall@10. Use it to rank candidates, then eval on YOUR corpus. Do NOT pick by MTEB alone.

## 3. Open disputes / judgment calls
- **"Just use Postgres" vs dedicated engine** — genuinely contested. ParadeDB (pg_search) +
  pgvector is now credible for BM25+vector, but it's younger (ORM gaps #1100, non-latin #3782,
  JOIN perf maturing) and you hand-roll fusion. The honest answer is "depends on corpus size,
  existing infra, and whether you need engine-grade faceting/typo UX." I gave taste in file 06
  but reasonable engineers disagree.
- **Typesense vs Meilisearch as truffle's default** — I picked Meilisearch (DX + official
  MCP/CLI + hybrid default-on) but Typesense wins on raw latency + multitenancy (scoped keys) +
  cleaner hybrid API. It's close; the "right" default depends on whether truffle weights
  agent-tooling (Meili) or latency+multitenancy (Typesense) higher.
- **Self-host vs managed break-even** — the ~10-15M embeddings/month self-host break-even
  (file 04) and the Algolia-cost-at-scale ranges (file 06) are from blog sources; the real
  number depends heavily on your query volume and infra. Directional, not gospel.

## 4. Methodology notes (for reproducibility)
- All GitHub stars/dates/issues via `gh api` + `gh search`, run 2026-06-17 (one date rollover
  during the session; treat "2026-06-17" as the as-of date).
- Issues ranked by `sort:reactions-desc` and `sort:comments-desc` — high comments = real
  debugging pain, high reactions = many people affected. I read bodies/maintainer replies, not
  just titles.
- Docs flows pulled from official sources (Typesense via context7 `/websites/typesense_29_0_api`;
  Meilisearch via firecrawl on the official hybrid-search docs). Copy-paste-grade syntax.
- Internal corpus (memory-search.sh, brain_search.py, bm25.test.ts, the audit checklist) READ
  ONLY — quoted, never edited, per mission scope rules.
