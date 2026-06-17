---
title: "Search Ecosystem — Elasticsearch 9.x & OpenSearch 3.x Per-Minor Deltas (June 2026)"
type: source
created: "2026-06-17"
updated: "2026-06-17"
tags: [search, elasticsearch, opensearch, changelog, vector, bbq, gpu, esql, agent-builder, neural-search]
summary: "Closes GAPS follow-up #1: the granular per-minor feature deltas for the ES 9.0→9.4 and OpenSearch 3.0→3.7 arc that file 00 deferred. Verified release DATES via gh api; feature deltas from official Elastic/OpenSearch sources, GA-vs-preview labeled."
researcher: "truffle ECOSYSTEM (CP123 Wave-R) — second pass, gap-closing"
---

# Elasticsearch 9.x & OpenSearch 3.x — the per-minor deltas (gap-closer)

> WHY THIS FILE EXISTS: `ecosystem-00` and `ecosystem-08` (GAPS, item #1) flagged that the
> granular ES 9.0→9.4 and OpenSearch 3.0→3.7 feature lists were NOT crawled (the OSS engines
> Meili/Typesense were prioritized per mission). This file closes that gap. **Release tags +
> dates are gh-api-verified (authoritative); feature deltas are from official Elastic /
> OpenSearch sources with access dates inline, and each is labeled GA vs Technical Preview.**

---

## 0. Verified release ledger (gh api, 2026-06-17)

| Engine | Releases (newest first) | Stars (live) |
|---|---|---|
| **Elasticsearch** | v9.4.2 (2026-05-28), v9.3.5 (2026-05-28), v8.19.16 (2026-05-28 — 8.x LTS still patched) | **77,048★** (file 00's "~73k" was stale; corrected) |
| **OpenSearch** | 3.7.0 (2026-06-09), 3.6.0 (2026-04-07), 2.19.5 (2026-05-13 — 2.x still patched) | ~10k★ |

Source: `gh api repos/elastic/elasticsearch/releases`, `gh api repos/opensearch-project/OpenSearch/releases`, run 2026-06-17.
NOTE: both projects backport to the PRIOR major (ES 8.19.x, OpenSearch 2.19.x) the same week as
the current-major patch — so anyone pinned to ES 8 / OpenSearch 2 still gets security/bugfix
backports. Relevant for migration planning: you are NOT forced to 9.x / 3.x immediately.

---

## 1. ELASTICSEARCH 9.0 → 9.4 — the search/vector feature arc

> Sources: Elastic "What's new in 9.0" (https://www.elastic.co/blog/whats-new-elastic-search-9-0-0),
> Elastic "What's new in 9.4" (https://www.elastic.co/blog/whats-new-elastic-9-4-0), and the
> Elasticsearch Labs BBQ blog (https://www.elastic.co/search-labs/blog/bbq-implementation-into-use-case).
> All accessed 2026-06-17. The single THROUGH-LINE of the 9.x arc is **vector quantization
> (BBQ) + GPU indexing** — Elastic spent 9.x making dense-vector search dramatically cheaper
> on RAM and faster to build, which is the real "ES is competitive on vector now" story.

### 9.0 (GA Apr 2025) — the vector-cost reset
- **Better Binary Quantization (BBQ) — GA.** 1-bit quantization of dense vectors; Elastic's
  headline claim: "5x faster than OpenSearch" and a large recall-preserving compression. This
  is the start of the BBQ thread that runs through the whole 9.x line.
- **ColPali / ColBERT support + JinaAI embeddings & reranking** integrated (late-interaction /
  multi-vector retrieval lands in ES).
- Lucene 10 base (faster vector search, better segment merges).

### 9.1 — BBQ becomes the DEFAULT
- **BBQ is now the DEFAULT for new `dense_vector` indices** — "cuts heap requirements by more
  than 95% over float32." This is the big one for cost: you no longer opt-in to quantization;
  new vector indices are quantized by default. (Source: Elastic release notes via the BBQ blog +
  releasebot, accessed 2026-06-17.)
- **ES|QL** continued maturing toward full production readiness.

### 9.2 — DiskBBQ GA
- **DiskBBQ — GA.** Reads vectors FROM DISK at "sub-20ms latency with a 100 MB memory footprint
  regardless of index size." This is the move that lets ES do large-scale vector search WITHOUT
  holding all vectors in RAM (the exact constraint that bites Typesense — see ecosystem-03 #644).
  For truffle's "scale ceiling" axis, DiskBBQ is why ES/OpenSearch out-scale the in-memory OSS
  engines on vectors.

### 9.3 — GPU indexing (preview) + agentic in Kibana
- **GPU-accelerated vector indexing — Technical Preview** (NVIDIA cuVS).
- Agentic automation surfaced directly in Kibana (the Agent Builder lineage).

### 9.4 (current, v9.4.2 = 2026-05-28) — GPU GA + DiskBBQ multi-bit + Agent Builder GA
Source: https://www.elastic.co/blog/whats-new-elastic-9-4-0 (accessed 2026-06-17).
- **GPU-accelerated vector indexing — now GA** (NVIDIA cuVS): "up to a 12x improvement in
  indexing throughput" and "7x faster force merging." (Was preview in 9.3.)
- **DiskBBQ improvements — GA:** "query latency improving by at least 3x for queries with
  restrictive filters" + you can now BBQ-quantize to **2, 4, and 7-bit** vectors (not just
  1-bit) — "enabling better recall when a single bit is insufficient." This directly addresses
  the BBQ recall-loss complaint.
- **Agent Builder — GA**, with new agent-context primitives: **Skills** ("instructional guides
  that teach the agent how to complete specific tasks"), **Attachments**, **Connectors** (query-
  result offloading + summarization), and a **semantic metadata layer** for agent discovery
  across Elastic + connected sources (Drive, SharePoint). → ES is explicitly building an
  agent-native search surface, parallel to Algolia's MCP play and OpenSearch's agentic search.
- **Workflows — GA**; ES|QL time-series; Prometheus/PromQL (preview).
- **NOTABLE ABSENCE (honesty):** the 9.4 post does NOT re-announce `semantic_text`, explicit
  reranking, or retriever/RRF — those landed in the 8.x→9.0 window and are stable, not 9.4-new.
  (`semantic_text`, RRF retrievers, ELSER are all pre-9.4 and covered in ecosystem-02 §3.)

### ES 9.x through-line for truffle
The 9.x arc is **"make dense-vector search cheap and fast at scale"**: BBQ default (95% less
heap) → DiskBBQ (vectors on disk, sub-20ms) → GPU/cuVS indexing (12x throughput) → multi-bit
BBQ (recover recall). Plus **Agent Builder GA** = ES is now an agent-native search target. If
truffle ever needs large-scale vector + keyword + analytics in ONE system, 9.x is materially
more competitive than the pre-9.0 "vector bolted on Lucene" story (ecosystem-03 ES #42326).

---

## 2. OPENSEARCH 3.0 → 3.7 — the search/vector feature arc

> Sources: OpenSearch 3.0 release notes
> (https://github.com/opensearch-project/opensearch-build/blob/main/release-notes/opensearch-release-notes-3.0.0.md),
> 3.5 release notes (same repo, 3.5.0.md), OpenSearch perf-progress blog
> (https://opensearch.org/blog/opensearch-project-update-performance-progress-in-opensearch-3-0/),
> all accessed 2026-06-17. THROUGH-LINE: OpenSearch matched ES's GPU/vector push (also NVIDIA
> cuVS) AND went hard on **agentic search + MCP** — arguably MORE openly agent-native than ES.

### 3.0 (GA May 2025) — GPU vector + the Lucene-10 reset
- **GPU acceleration for vector search — experimental** (NVIDIA cuVS): "up to 9.3x faster
  indexing" and "3.75x" lower cost vs CPU. (Mirrors ES's cuVS bet, ~same timeframe.)
- "11x faster than OpenSearch 1.3" headline perf (the cumulative 1.x→3.0 gain).
- First major under the **OpenSearch Software Foundation / Linux Foundation** governance
  (cross-ref ecosystem-00 §3 — the "no longer AWS-only" story).

### 3.1 — GPU index builds GA + semantic field + star-tree
- **GPU-accelerated index builds — GA** (was experimental in 3.0).
- **Semantic field support** (the OpenSearch analog to ES `semantic_text` — declare a field,
  it auto-embeds).
- **Star-tree indexes** for aggregation acceleration "up to 100x."

### 3.3 — gRPC transport + cumulative perf
- "11x faster performance compared to OpenSearch 1.3"; **gRPC transport expanded across major
  query types** (a lower-overhead wire protocol than REST/JSON for high-QPS agent traffic).

### 3.4 — the agentic-search turn (MCP lands)
- **No-code agentic search UX with Model Context Protocol (MCP) integration.** This is
  OpenSearch's clearest agent-native move — agentic search built into the product, MCP-wired.
  (Cross-ref ecosystem-05: there's also the official `opensearch-mcp-server-py`, 132★.)

### 3.5 (Feb 2026) — agentic memory + hybrid-search fixes + LLM-as-judge
Source: 3.5.0 release notes (accessed 2026-06-17).
- **Agentic conversation memory** — "persistent, structured memory for AI agents, directly in
  OpenSearch." OpenSearch is positioning itself as the MEMORY store for agents, not just search.
- **Hook-based context management** — "automatic truncation, summarization, and sliding window
  strategies" for LLM token optimization.
- **AG-UI (Agent-User Interaction) protocol — experimental** — event-based streaming agent
  interactions.
- **k-NN: bulk SIMD** — "58% throughput improvement for FP16 vectors in multi-segment scenarios
  while maintaining 94% recall"; **asymmetric embedding model support** (different index-time vs
  query-time embedder — same capability Meili added in 2026, ecosystem-00 §2).
- **Hybrid search fixes:** RRF score-calculation accuracy fixes, `min_score` in hybrid,
  collapse bugs, different-shard-count edge cases. (i.e. OpenSearch's hybrid/RRF had real
  correctness bugs being fixed as recently as 3.5 — relevant if truffle leans on OS hybrid.)
- **Search Relevance Workbench + "LLM as judge"** — automated relevance eval with custom prompts
  + scheduled baseline testing. (This is an EVAL tool baked into the engine — directly relevant
  to truffle's own eval discipline.)

### 3.6 (2026-04-07) & 3.7 (2026-06-09) — DATES verified, granular features NOT pinned
- **HONEST GAP:** I have the release DATES via `gh api` (3.6.0 = 2026-04-07, 3.7.0 = 2026-06-09)
  but could NOT reach the 3.6/3.7 release-notes markdown via WebFetch/search in this pass (the
  build-repo path resolved only up to 3.5.0). The 3.0→3.5 feature arc above is solid and is the
  load-bearing trajectory; 3.6/3.7 are recent patch-minors on top. FOLLOW-UP for truffle:
  `gh api repos/opensearch-project/opensearch-build/contents/release-notes/opensearch-release-notes-3.7.0.md`
  or crawl opensearch.org/releases for the exact 3.6/3.7 deltas.

### OpenSearch 3.x through-line for truffle
OpenSearch tracked ES's GPU/cuVS + Lucene-10 vector push **and** went further on agent-native
surfaces: MCP-integrated agentic search (3.4), agentic conversation MEMORY + hook-based context
mgmt + AG-UI (3.5), LLM-as-judge relevance eval. Plus it's **Apache-2.0 + LF-governed** (no
single-vendor control). If truffle weights "agent-native + open governance + scale" it's a
genuinely strong pick; the caveat is hybrid/RRF correctness bugs were still being fixed as late
as 3.5, so eval YOUR hybrid queries on the exact version.

---

## 3. ES vs OpenSearch — the 2026 honest delta (updates ecosystem-06)

Both converged on the SAME 2026 capabilities (GPU/cuVS vector indexing, Lucene-10, hybrid/RRF,
semantic/auto-embed field, agentic surfaces). The real differentiators now:

| Axis | Elasticsearch 9.x | OpenSearch 3.x |
|---|---|---|
| License | **AGPLv3** (re-opened 2024) + Elastic-License-v2 / SSPL options | **Apache-2.0** (always) |
| Governance | Elastic (single vendor) | **OpenSearch Software Foundation / Linux Foundation** (multi-vendor) |
| Vector cost-at-scale | **BBQ default + DiskBBQ + multi-bit** (most mature quantization story) | GPU builds GA + bulk SIMD; quantization present but ES leads on BBQ specifics |
| GPU indexing | **GA in 9.4** (cuVS, 12x) | GA in 3.1 (cuVS, ~9.3x) — shipped GPU-GA EARLIER |
| Agent-native | Agent Builder GA (Skills/Connectors/semantic metadata) | MCP agentic search (3.4) + agentic conversation MEMORY (3.5) + AG-UI |
| Eval tooling | (Kibana-side) | **Search Relevance Workbench + LLM-as-judge built in** |
| Managed | Elastic Cloud | AWS OpenSearch Service + others |

TASTE (grounded in the above): for a NEW build that wants **open governance + Apache-2.0 + the
most openly agent-native posture (MCP + agentic memory + built-in LLM-as-judge eval)**, lean
**OpenSearch 3.x**. For the **most mature vector-quantization-at-scale story (BBQ default +
DiskBBQ + multi-bit) + the polished Agent Builder**, lean **Elasticsearch 9.x** — accepting AGPL
+ single-vendor governance. The 2021 license war is over (ES is AGPL again); the choice is now
governance + vector-cost-engineering + agent-tooling, exactly as ecosystem-00 §6.5 concluded.
For a TYPICAL product search box, BOTH remain overkill vs Meilisearch/Typesense/Postgres
(ecosystem-06 §3) — ES/OS earn their ops weight only at petabyte scale, logs+search-in-one, or
heavy aggregations.
