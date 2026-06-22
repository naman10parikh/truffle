# AGENTS.md — truffle (Search / Retrieval / Relevance Employee)

> How a coding agent drives truffle. truffle is the Energy fleet's search domain-expert employee, consumed by
> coding agents (Claude Code, the energy hub, sibling employees) via **CLI and MCP**. Powered by Energy.

## What truffle does

truffle takes a query and returns the **right ordered results** — typo-tolerant, faceted, relevance-ranked,
via hybrid (BM25 + vector) — and proves it with a golden-query eval that catches silent regressions. It picks
the right engine for the corpus-size/control question (Meilisearch default; Typesense for
latency/multitenancy; Postgres+pgvector for "one fewer service"; Algolia / ES / OpenSearch only when
justified), designs the hybrid query + fusion, tunes relevance (RRF floor → tiered boost → reranker), gets
faceting/filtering/typo-tolerance right at scale, isolates tenants at the search layer, and ships the
version-bump regression loop ("search is never done").

## The boundary (place every task here FIRST)

truffle owns **search / retrieval / relevance ranking ONLY** — the query, the hybrid fusion, the relevance
tuning, the reranker, the faceting, the typo-tolerance, the multi-tenancy primitive, the iterative-scan
*setting*, and the eval loop.

- truffle does **NOT** own the **pgvector DB / Postgres box** — that is **acorn** (truffle consumes the
  connection; acorn provisions and sizes the box).
- truffle does **NOT** own the **LLM generation** step that reads the top-8 chunks — that's **downstream**;
  truffle owns *getting the right top-8*.
- One-line handoff rule: *"truffle = the query, the ranking, and the relevance proof; acorn = the pgvector box
  the vectors sit in."* `[brain/OPINIONS.md O1; brain/KNOWN-PITFALLS.md P25]`

## The 5-stance spine (quick-ref — full taste in `brain/OPINIONS.md`)

1. **Boundary first** — retrieval/relevance → truffle; pgvector DB → acorn; LLM generation → downstream.
   Don't over-correct and rip out a good in-house BM25 for a tiny offline corpus.
2. **Hybrid + reranker is the 2026 default** — pure vector lost; RRF is the floor not the finish (tune the
   tiers); the reranker is the biggest single lever (except when latency/MRR says skip).
3. **MTEB is a prior not an oracle; eval on YOUR golden set; search is never done.**
4. **Right-size the engine; answer corpus-size/control first** — Meili default.
5. **Version discipline + agent hygiene** — never treat a bump as a no-op; MCP first; Meili writes are async
   (poll tasks); verify filtered-ANN; server-enforced multi-tenancy.

## Tools (CLI + MCP)

> Placeholder — filled with the real CLI verbs + the 11 MCP tools once the CLI (Cluster B) and MCP server
> (Cluster C) land. Finalized in F21 / F2. The CLI command tree and the MCP `truffle_*` tool list are the two
> reachable surfaces; the cockpit (`scripts/serve.sh`) is the chairman's view only.

- **CLI:** `truffle --help` (command tree: `index`, `search`, `engine select|up`, `hybrid design|fuse`,
  `facet plan`, `rerank advise`, `embed advise`, `tenant key`, `eval`, `doctor`, `brain search`) — TBD-filled.
- **MCP:** server `truffle` over stdio, 11 tools (`truffle_index`, `truffle_search`, `truffle_engine_select`,
  …) — TBD-filled.

## Brain

truffle's expertise lives in `brain/` (6 Wave-R artifacts + MOC), BM25-searchable via `truffle brain search`.
This is the in-house-BM25 case kept on purpose (a few hundred offline notes — the litmus test says keep BM25,
don't stand up Meili for the brain itself).

## Commit convention

`feat(skill):` · `feat(employee):` · `feat(company):` — so git snap-back works at all 3 granularities.
