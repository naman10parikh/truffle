---
title: "Search Ecosystem — Honest Trade-off Matrix & Decision Guide (June 2026)"
type: synthesis
created: "2026-06-17"
updated: "2026-06-17"
tags: [search, tradeoffs, comparison, decision, typesense, meilisearch, algolia, elasticsearch, pgvector]
summary: "The honest when-to-use-which across all canonical engines, with specific numbers, stated weaknesses, and explicit taste. Synthesized from multiple comparisons + the issues/breakage evidence — NOT a single marketing page."
researcher: "truffle ECOSYSTEM (CP123 Wave-R)"
---

# Honest Trade-off Matrix (June 2026)

> SOURCES (cross-checked, no single page trusted): blog.vibecoder.me comparison (accessed
> 2026-06-17), meilisearch.com/blog/algolia-vs-typesense, typesense.org/typesense-vs-*,
> blog.elest.io comparison, GitHub issue #1148, PLUS the breakage evidence in
> ecosystem-03. Where a number comes from ONE vendor-adjacent source I flag it. The taste is
> mine, grounded in the evidence.

---

## 1. The headline scorecard (relative, from cross-source synthesis)

| Dimension | Algolia | Typesense | Meilisearch | Elastic/OpenSearch | PG + pg_search + pgvector |
|---|---|---|---|---|---|
| Raw query speed | high | **highest** (C++, in-mem, sub-ms) | high | medium (JVM) | medium |
| Relevance defaults | **best** (decade-tuned) | very good | very good | good (needs tuning) | DIY |
| Self-host ease | n/a (cloud-only) | good | **best** (polished DX) | hard (ops-heavy) | trivial (you have PG) |
| AI/vector maturity | **best** (NeuralSearch) | very good (hybrid prod-ready) | very good (default-on 2026) | very good (RRF+ELSER) | good (0.8 fixed filtered-ANN) |
| Multi-tenancy | good (managed) | **best** (HMAC scoped keys) | good (tenant JWT) | good (index/alias) | DIY (row-level security) |
| Scale ceiling | very high (managed) | medium-high (RAM-bound) | medium-high (RAM-ish) | **highest** (petabyte) | medium (depends on PG) |
| Agent tooling (MCP/CLI) | **best** (2 hosted MCPs + CLI) | weakest (no official MCP/CLI) | strong (official MCP+CLI) | strong (official MCP) | strong (psql/SQL + PG MCP Pro) |
| Cost at scale | **worst** (per-query+record) | flat (your box) | flat (your box) | infra cost | ~free (existing PG) |
| Ecosystem/integrations | **largest** | smaller | medium (growing) | very large | huge (it's Postgres) |

Specific numbers (from vibecoder comparison, vendor-adjacent so treat as directional):
Typesense query speed 95% vs Algolia 85% vs Meili 80%; Algolia relevance 95% vs others 82-85%;
Meili self-host ease 90% vs Typesense 80%. Pricing: Algolia 1M searches/mo ≈ $500-1,500;
10M/mo ≈ $3,000-8,000 — vs self-hosted ≈ $50-100 then $200-400. (These ranges are the WHY
behind "Typesense/Meilisearch exist because Algolia gets expensive at scale.")

---

## 2. Stated weaknesses (the honest part — each tool's Achilles heel)
- **Algolia:** expensive at scale + vendor lock-in. The per-query/per-record model punishes
  high-volume internal querying (exactly what an agent does). You don't own the box.
- **Typesense:** smaller community, fewer integrations, **no official MCP/CLI**, and **whole
  index must fit in RAM** (incl. vectors → blows up fast). HA Raft clustering is fiddly
  (issue #465, 74💬). In-memory = vulnerable to OOM on big exports (#1067).
- **Meilisearch:** smaller ecosystem, fewer enterprise features; **async-write model** trips
  agents (poll tasks); deploy-time memory spikes when storing vectors (#5616); default
  matching strategy can silently drop typo'd multi-word hits (#4093); attribute-declaration
  footguns (#761/#767/#1630). Historically trailed on vector (now default-on, fixed).
- **Elastic/OpenSearch:** operationally heavy (JVM, cluster ops, shard mgmt); vector search
  is bolted onto a keyword engine (#42326 multi-year retrofit); huge API surface; deep
  pagination + aggregations are perennial pain (#4915, 207💬). Overkill for simple search.
- **Postgres (pg_search+pgvector):** you hand-roll hybrid fusion (RRF in SQL); HNSW dims
  capped at 2000/4000 (#461); pg_search is young (no Prisma ORM #1100, weak non-latin #3782,
  JOIN perf maturing); filtered-ANN needs ≥0.8 + iterative scans (#259). Not a search ENGINE,
  a search-capable DB — fine until you need engine-grade relevance/faceting UX.

---

## 3. The decision guide (explicit taste)

**Pick Typesense when:** you want the fastest raw latency + the cleanest hybrid API
(`query_by: "text,embedding"` auto-fuses) + best multi-tenancy (HMAC scoped keys baked with a
`filter_by`) + vector search without a vendor. Accept: RAM-bound, fiddly HA, no official MCP.
Best for: instant search-as-you-type, multi-tenant SaaS search, latency-critical UX.

**Pick Meilisearch when:** you want the easiest self-host + best DX + agent-native tooling
(official MCP + official CLI) + hybrid-on-by-default. Accept: async writes (poll tasks),
attribute-declaration discipline, deploy RAM headroom for vectors. Best for: docs/content
search, MVPs, side projects, anything where DX and "it just works" matter most. **My default
recommendation for truffle's turnkey path.**

**Pick Algolia when:** relevance is revenue-critical (e-commerce), you want zero ops, and you
have budget. Best agentic MCP tooling (Public + Productivity, "built for the agentic era").
Accept: per-query/record cost (bad for high-volume agent querying) + lock-in. Best for:
enterprise e-commerce search where conversion > infra cost.

**Pick Elasticsearch/OpenSearch when:** petabyte scale, log/observability + search in one,
heavy aggregations/analytics. ES = AGPL again (license fear gone); OpenSearch = Apache-2 +
Linux-Foundation-governed (pick OpenSearch if you want no single-vendor control). Accept: ops
weight. Overkill for a typical product's search box.

**Pick Postgres + pg_search + pgvector when:** you ALREADY run Postgres and want "one fewer
service." Agent drives it via plain SQL (most agent-legible). Accept: DIY RRF fusion, dims
caps, younger BM25 extension. Best for: small-to-mid corpora, teams allergic to new infra, and
when "good enough hybrid in the DB" beats "best-in-class engine + another service to run."

---

## 4. truffle's recommended DEFAULT STACK (synthesizing all six files)
1. **Engine:** **Meilisearch** (turnkey, official MCP+CLI, hybrid default-on) as the primary
   Search-employee recommendation; **Typesense** as the alt when multitenancy/latency dominate;
   **Postgres+pgvector+pg_search** as the "no new infra" option. (This trio directly fills the
   energy checklist `Search ❌ GAP — only in-process BM25`.)
2. **Embeddings:** OpenAI `text-embedding-3-small` default; **Jina v3** for best price/quality;
   **voyage-3-large** for long-context/quality-critical.
3. **Retrieval:** hybrid (BM25+vector, RRF) → top-100 → **cross-encoder rerank** (Cohere
   rerank-3.5 / Voyage / BGE-reranker) → top-8. The reranker is the biggest quality lever.
4. **Freshness:** treat indexing as async (poll Meili tasks / ES `refresh=wait_for`), re-embed
   only changed docs (cached), monitor the index task queue + disk trend, not just query p99.
5. **vs the in-house BM25:** truffle SUPERSEDES the grep/Python BM25 in wikimem/sentinel/
   memory-search.sh for any real product surface (those are fine for tiny local corpora — see
   ecosystem-07). Truffle's edge = real inverted index + faceting + typo tolerance + hybrid +
   multitenancy that hand-rolled BM25 can't touch.
