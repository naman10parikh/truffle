---
title: "Search Ecosystem — What an AGENT (not a human) Operating These Tools Needs (June 2026)"
type: source
created: "2026-06-17"
updated: "2026-06-17"
tags: [search, agent, mcp, cli, api, automation, truffle, typesense, meilisearch, algolia]
summary: "CLIs, APIs, and MCP servers for every canonical search engine — verified via gh api 2026-06-17. The agent-operator angle: how a Claude-Code-style agent drives each tool, the async/idempotency gotchas, and the official-vs-community MCP status."
researcher: "truffle ECOSYSTEM (CP123 Wave-R)"
---

# Agent-Operator's Map — CLIs, APIs, MCP servers (June 2026)

> All repo stars/dates verified via `gh api` on 2026-06-17. "Official" = published by the
> vendor's GitHub org. This is the file truffle (the Search employee) consumes to actually
> OPERATE these engines, not just describe them.

---

## 1. MCP servers — the agent-native control surface (verified)

| Engine | MCP server | Official? | Stars | Last push | Verdict |
|---|---|---|---|---|---|
| **Meilisearch** | `meilisearch/meilisearch-mcp` | ✅ OFFICIAL | 192 | 2026-06-09 | USE — first-party, maintained |
| **Elasticsearch** | `elastic/mcp-server-elasticsearch` | ✅ OFFICIAL | 674 | 2026-06-11 | USE — first-party |
| **OpenSearch** | `opensearch-project/opensearch-mcp-server-py` | ✅ OFFICIAL | 132 | 2026-06-16 | USE — first-party, active today |
| **Algolia** | Algolia hosted MCP (Public + Productivity) + `algolia/mcp` (experimental) | ✅ vendor hosted | n/a | live | USE if on Algolia — see §4 |
| **Postgres (pgvector)** | `crystaldba/postgres-mcp` ("Postgres MCP Pro") | community (serious) | 2,918 | 2026-01-22 | USE — read/write + perf analysis, the de-facto Postgres MCP |
| **Typesense** | `avarant/typesense-mcp-server` (8★), `akshitkrnagpal/typesensekit` (CLI+MCP, 2★) | ❌ community-only | 8 / 2 | 2026-05 | GAP — no official MCP; thin community options |

KEY SIGNAL: **Typesense has NO official MCP and NO official CLI** — only thin community wraps.
Meilisearch, Elastic, OpenSearch, and Algolia all ship first-party MCPs. **This is a real
differentiator for an agent-first product:** if truffle wants the most agent-native engine
TODAY, Meilisearch (official MCP + official CLI) and Algolia (two hosted MCPs, explicitly
"built for the agentic era") are ahead of Typesense on tooling — even though Typesense's
scoped-key multitenancy and clean hybrid API are excellent. Truffle could FILL the Typesense
MCP gap (a `truffle`-built Typesense MCP/CLI would be a genuine OSS contribution).

---

## 2. CLIs (verified via gh search, 2026-06-17)

| Engine | CLI | Official? | Notes |
|---|---|---|---|
| **Meilisearch** | `meilisearch/meilisearch-cli` | ✅ OFFICIAL | manage platform from terminal; also community `sanders41/meilisearch-cli` (12★, Python) |
| **Typesense** | `AlexBV117/typesense-cli` (17★), `getclera/typesense-cli` | ❌ community | no official CLI; the server binary itself is the only first-party CLI surface |
| **Elasticsearch** | (no single CLI; `eland` Python, `elasticsearch` clients, Kibana Dev Console) | partial | agents drive via REST or the official language clients |
| **OpenSearch** | `opensearch-cli` (older) + clients | partial | mostly REST + Dashboards |
| **pgvector/pg_search** | `psql` (it's just SQL!) | ✅ (Postgres) | the agent's "CLI" is `psql -c "..."` — huge advantage: agents already know SQL |
| **Algolia** | Algolia CLI + `algoliasearch` clients | ✅ OFFICIAL | + InstantSearch UI libs (React/Vue/JS) |

TAKEAWAY: For a Bash-driving agent, the cleanest control surfaces are (a) **Postgres = `psql`
+ SQL** (no new API to learn), (b) **Meilisearch = official CLI + simple REST + official MCP**,
(c) **Algolia = official CLI + MCP**. Typesense is REST-only-in-practice for automation.

---

## 3. REST API shape — what the agent actually emits

All five are HTTP/JSON (Postgres is SQL-over-libpq). The agent-relevant differences:

- **Typesense:** `X-TYPESENSE-API-KEY` header. Single-server REST on :8108. `/multi_search`
  batches N queries in ONE request (federated search) — agents should batch. Scoped keys
  (HMAC) for per-tenant filters. Synchronous-ish writes (in-memory).
- **Meilisearch:** `Authorization: Bearer <key>` on :7700. **ASYNC writes → `taskUid` → poll
  `/tasks/{uid}`.** This is the #1 thing an agent must encode: do NOT assume a doc is
  searchable right after POSTing it. Master key vs tenant tokens (JWT) for multitenancy.
- **Elasticsearch/OpenSearch:** big REST surface (Query DSL JSON). `refresh=wait_for` on a
  write makes it searchable before returning (agent-friendly idempotency trick). Bulk API for
  throughput. ES|QL endpoint for piped queries (more legible than DSL).
- **Algolia:** REST + thick clients. Per-search + per-record billing → an agent must be
  COST-AWARE (every query and every reindex costs money). Batch indexing (1K-10K records,
  ~10MB/batch per Armory's algolia skill). Avoid `deleteBy` (expensive); prefer
  `partialUpdateObjects` for attribute-only changes.
- **Postgres:** SQL. Writes synchronous. The agent builds/refreshes HNSW indexes itself.

---

## 4. Algolia's agentic play (the one vendor leaning ALL the way in)
Source: algolia.com/doc/guides/model-context-protocol + algolia.com/about/news/
algolia-introduces-context-aware-retrieval-for-the-agentic-era (June 16, 2025), accessed 2026-06-17.
- **Algolia Public MCP:** search on selected indices + recommendation models — "all the
  Search & Discovery capabilities." App-scoped auth via dashboard-generated server URLs.
- **Algolia Productivity MCP:** read-only index access + analytics tools; broader data
  exploration across user-accessible apps; auth required (e.g. via MCP registries).
- Both are **Algolia-MANAGED (hosted)** — you don't run them. "Context-Aware Retrieval for the
  Agentic Era" is Algolia's positioning: agents get secure, governed, real-time access to
  business context. This is the clearest "search-engine-built-for-agents" stance in the market.
- TASTE: Algolia's agentic tooling is the most polished, but you pay the SaaS premium + per-
  query cost. For an agent product that does MANY internal queries, that cost model can bite
  (the classic reason people migrate off Algolia at scale — see trade-off file).

---

## 5. The agent-operator gotcha checklist (encode these into truffle's skills)
1. **Meilisearch writes are ASYNC.** Always poll `/tasks/{uid}`; never assume immediate
   searchability. (Typesense/Postgres are synchronous; ES use `refresh=wait_for`.)
2. **Declare attributes explicitly** (Meili filterable/sortable/searchable; ES mappings).
   Silent failure if you filter/sort an undeclared attribute. (issues file #761/#767/#1630.)
3. **Filtered vector search can under-return.** pgvector ≥0.8 + `hnsw.iterative_scan`; verify
   your engine/version handles it. (issues file #259.)
4. **Embedding dims must fit the index cap.** pgvector HNSW ≤2000 (≤4000 halfvec). Use
   Matryoshka truncation (OpenAI/Cohere `dimensions` param) if needed. (issues file #461.)
5. **In-memory engines are RAM-bound.** Typesense holds the WHOLE index (incl. vectors) in
   RAM; budget RAM = index size × ~1.5, and test the DEPLOY-time memory spike (Meili #5616).
6. **Cost-aware on Algolia.** Every query + reindex costs $. Batch, partial-update, avoid
   `deleteBy`. For a high-internal-query agent, prefer self-hosted OSS.
7. **CJK / non-latin tokenization is weak everywhere.** Test the exact language path; don't
   assume. (issues file #1002, ParadeDB #3782, Meili tokenizer.)
8. **Prefer POST/multi_search over GET for complex filters** (URL-encoding bugs, Typesense
   #210). Agents building filter strings should never inline them into a GET URL.
9. **Idempotent index creation.** ES historically lacked "create if not exists" (#19862);
   agents must check-then-create or handle the 400. Meili index creation is idempotent.
10. **Batch operations.** Typesense `/multi_search`, ES `_bulk`, Meili batch document add,
    Algolia batched records — agents should batch, not loop single requests (latency + cost).

---

## 6. What truffle (the Search employee) should DO with this
- **Default product pick:** Meilisearch (official MCP + CLI + REST, hybrid default-on, weekly
  releases, Rust, 58K★) for turnkey agent-native hybrid search; OR Typesense (cleanest hybrid
  API + best multitenancy via scoped keys, 26K★) if multitenancy is paramount.
- **"One fewer service" pick:** Postgres + pg_search (BM25) + pgvector (vector) when the app
  already has Postgres and the team wants no new infra. Agent drives it via `psql`/SQL — the
  most agent-legible surface of all. Accept: you hand-roll RRF fusion + watch dims/HNSW caps.
- **Managed/enterprise pick:** Algolia (best agentic MCP tooling + relevance defaults) when
  budget > engineering time and per-query cost is acceptable.
- **Scale/log/analytics pick:** Elasticsearch (AGPL again) or OpenSearch (Apache-2, LF-governed)
  when you need petabyte scale, aggregations, and observability — accept the ops weight.
- **The retrieval-quality multiplier (any engine):** hybrid retrieve top-100 → cross-encoder
  rerank (Cohere rerank-3.5 / Voyage / BGE) → top-8. (embeddings-reranking file.)
- **OSS contribution opportunity:** there's NO official Typesense MCP/CLI — truffle building a
  clean `truffle-typesense` MCP + CLI would fill a real ecosystem gap and dogfood the Search
  employee.
