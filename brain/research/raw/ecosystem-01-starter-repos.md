---
title: "Search Ecosystem — Best Starter / Template / Example Repos (June 2026)"
type: source
created: "2026-06-17"
updated: "2026-06-17"
tags: [search, starter, template, examples, repos, typesense, meilisearch, rag, hybrid]
summary: "The 3-5 best starter/template/example repos per category — stars, last commit, and WHY each is worth cloning. Verified via gh api/gh search 2026-06-17. Filters out abandoned/listicle repos."
researcher: "truffle ECOSYSTEM (CP123 Wave-R)"
---

# Best Starter / Template / Example Repos (June 2026)

> All stars + last-push dates verified via `gh api repos/...` and `gh search repos` on
> 2026-06-17. I prioritized OFFICIAL example repos (maintained, canonical) + a few
> high-signal community ones, and excluded stale (>12mo) or thin-wrapper repos.

---

## 1. TYPESENSE — official examples + adapters (clone these)
- **typesense/typesense-instantsearch-adapter** — 518★, pushed 2026-03-26. THE way to build a
  rich search UI on Typesense: it adapts Algolia's InstantSearch widgets (React/Vue/JS) to
  Typesense. If truffle ships a UI, this is the starting point (reuse Algolia's mature widget
  ecosystem against an OSS backend). WHY: maintained, official, bridges the biggest Typesense
  weakness (UI libs) by borrowing Algolia's.
- **typesense/showcase-recipe-search** — 511★, pushed 2025-06-13. Instantly search 2M recipes;
  full end-to-end reference app (indexing + InstantSearch UI + faceting). WHY: a real,
  complete, copy-able example at non-trivial scale. (Note: last push ~1yr — stable demo, not
  abandoned core.)
- **typesense/showcase-songs-search** — 203★, pushed 2025-02-05. 32M songs (MusicBrainz) —
  proves Typesense at 32M docs with faceted instant search. WHY: scale reference + the dataset
  is public so you can reproduce. (Older; demo-grade.)
- **bfritscher/typesense-dashboard** — 645★, pushed 2026-03-24. Community admin UI to browse/
  manage collections. WHY: Typesense has no official dashboard; this is the de-facto one. Most-
  starred Typesense community repo. Actively maintained.
- **typesense/typesense-js** (561★, 2026-06-02) / **typesense-python** (242★, 2026-02-16) /
  **typesense-go** (316★, 2026-04-30) — official clients, all actively pushed. Start here for
  the language binding.

## 2. MEILISEARCH — official + ecosystem starters
- **meilisearch/meilisearch-js-plugins** — 530★, pushed 2026-06-16. InstantSearch integration
  + autocomplete for Meili. WHY: official UI bridge, maintained THIS WEEK. The Meili-UI start.
- **eyeix/meilisearch-ui** — 755★, pushed 2026-02-04. Pretty, fast community admin dashboard.
  WHY: most-starred Meili admin UI; fills the dashboard gap. Maintained.
- **Blazity/enterprise-commerce** — 690★, pushed 2026-05-28. Next.js enterprise storefront
  using Meilisearch (+Shopify). WHY: a REAL production-grade Next.js + Meili reference app, not
  a toy — shows faceting, filtering, instant search in a commerce context. Actively maintained.
- **laravel/scout** (1,664★) + **meilisearch-js** (864★, 2026-06-16) / **meilisearch-python**
  (599★, 2026-06-16) / **meilisearch-go** (673★, 2026-06-01) — official clients + the Laravel
  driver. All pushed within weeks. Start here for bindings.
- **open-wanderer/wanderer** — 3,675★, pushed 2026-06-17. Self-hosted trail DB using Meili for
  search. WHY: a popular, actively-developed real app you can read end-to-end to see Meili used
  in anger (not a demo).

## 3. RAG / HYBRID-SEARCH engines & reference pipelines (the agentic-retrieval starters)
- **oramasearch/orama** — 10,413★, pushed 2026-02-13. "A complete search engine and RAG
  pipeline in your browser, server or edge." WHY: full-text + vector + hybrid in a tiny
  embeddable JS lib — the best starter if you want search/RAG that runs in-process / at the
  edge (no separate server). Huge stars, the JS-land default. (Watch: pushed Feb 2026 —
  verify still active vs the weekly-shipping engines.)
- **infiniflow/infinity** — 4,570★, pushed 2026-06-16. "AI-native database built for LLM apps,
  incredibly fast hybrid search" (dense + sparse + full-text + tensor). WHY: if truffle wants a
  vector-native hybrid DB (vs retrofit), this is the modern reference. Actively shipping.
- **nixiesearch/nixiesearch** — 613★, pushed 2026-01-06. Hybrid engine combining text +
  semantic, Lucene-based, stateless-on-S3 design. WHY: interesting architecture (compute/
  storage split) for a cloud-native hybrid engine. Smaller but thoughtful.
- **RustyRAG/RustyRAG** — 195★, pushed 2026-05-14. Production-grade RAG API in Rust, hybrid
  HNSW dense + BM25 sparse. WHY: a clean, readable reference for the EXACT two-leg hybrid +
  fusion pattern truffle should implement. Recent.
- **theaiautomators/claude-code-agentic-rag-masterclass** — 173★, pushed 2026-01-29. Build an
  agentic RAG app FROM SCRATCH collaborating with Claude Code, 8-module course. WHY:
  DIRECTLY on-point for truffle — agent-built RAG, Claude-Code-native. Read this for the
  agent-operator workflow, not just the engine.

## 4. POSTGRES-NATIVE search (the "one fewer service" starters)
- **paradedb/paradedb** — 8,938★, pushed 2026-06-17 (TODAY). "Elastic-quality search for
  Postgres" — `pg_search` (BM25, Tantivy) + integrates pgvector. WHY: THE reference for
  BM25-in-Postgres + hybrid in SQL. Actively shipping (v0.24, Jun 2026). Clone for the
  Postgres hybrid path.
- **pgvector/pgvector** — 21,798★, pushed 2026-06-16, only 14 open issues (tight project).
  WHY: the canonical vector extension; read its README + the 0.8 iterative-scan docs for
  filtered-ANN. The substrate everything Postgres-vector builds on.
- **crystaldba/postgres-mcp** — 2,918★, pushed 2026-01-22. "Postgres MCP Pro" — read/write +
  perf analysis for agents. WHY: how an AGENT drives Postgres (incl. pgvector) via MCP. The
  agent-operator entry point for the Postgres path.

## 5. MCP servers worth cloning/reading (agent-native)
- **elastic/mcp-server-elasticsearch** (674★, 2026-06-11, OFFICIAL) — read for how a mature
  vendor models search-as-MCP-tools.
- **meilisearch/meilisearch-mcp** (192★, 2026-06-09, OFFICIAL) — cleanest official search MCP
  to template a `truffle` MCP from.
- **opensearch-project/opensearch-mcp-server-py** (132★, 2026-06-16, OFFICIAL) — Python,
  cluster-mgmt + search tools.
- **akshitkrnagpal/typesensekit** (community) — combined Typesense CLI + MCP; the ONLY Typesense
  MCP option → confirms the gap truffle could fill with an official-quality build.

---

## Selection heuristics applied (so truffle can re-run this)
1. Prefer the VENDOR's own example/adapter repo (canonical, maintained) over community demos.
2. Stars are a weak signal alone — I weighted `pushedAt` heavily (anything stale >12mo flagged
   as "demo-grade, not core"). The weekly-shipping engines (Meili, ParadeDB) and their
   THIS-WEEK-pushed client repos are the live ones.
3. For RAG, prefer repos that show the TWO-LEG hybrid + fusion + (ideally) rerank pattern, not
   just "vector search demo."
4. The Claude-Code-agentic-RAG masterclass is the one repo that matches truffle's identity
   (agent-built search) — disproportionately useful for HOW, not just WHAT.
