---
name: select-search-engine
description: Pick the right search engine (or use Postgres) for a corpus. Use when the user asks "which search backend / should we use Elasticsearch / Algolia / Postgres / Meilisearch for search", "pick a search engine", or is standing up a new search box. Answers the corpus-size/control routing question FIRST, then produces a decision with the honest cost — never a feature table.
brain_source: brain/EXPERTISE-MAP.md JTBD-1 · brain/OPINIONS.md O11/O12/O13/O15 · brain/TOOL-MATRIX.md Cat-1 · brain/BATTLE-TESTED-SCENARIOS.md S2/S13/S16
---

# select-search-engine

> Encodes JTBD-1 (the selection job). The first move is NOT naming an engine — it is **answering the
> corpus-size/control routing question**, then placing the task on the boundary, then routing to a default with
> the honest cost. "Search platform" ≠ "search box" — most engine disputes dissolve once you separate them
> `[brain/OPINIONS.md O11]`.

## Trigger

Fire when the request is any of: "pick a search engine", "which search backend", "should we use
Elasticsearch / Algolia / Postgres / Meilisearch / OpenSearch for search", "what's the best search engine
for X", "we're adding search to our product". Also fire when a teammate proposes an engine **by default**
("let's just use Elasticsearch") — that's the resume-driven anti-pattern this skill exists to catch
`[O13, S13]`.

## Steps

1. **Place the task on the boundary FIRST `[brain/EXPERTISE-MAP.md boundary; O1]`.** If the real question is
   "where do the vectors physically live / provision-or-size the Postgres+pgvector box," that is **acorn's**
   substrate — cite it, do not duplicate it. truffle owns the retrieval/relevance layer ON TOP. If the
   question is "make the LLM answer better from the chunks," that's downstream. Only proceed if the task is
   genuinely engine/retrieval selection.

2. **Ask the routing question before naming any engine `[O11; EXPERTISE-MAP JTBD-1.1]`:** *"Does a human
   end-user type queries into this, expecting typo-tolerant, faceted, relevance-ranked results — and at what
   corpus size, with what ops appetite, and is it multi-tenant / latency-critical / already-on-Postgres?"*
   Run `truffle engine select --corpus-size <n> [--multitenant] [--latency-critical] [--on-postgres]
   [--ops-appetite low|high] --json` — the decision tree is deterministic (pure code), not an LLM guess.

3. **Apply the litmus test for the in-house-BM25 escape hatch `[O2, S16; JTBD-11.4]`:** if it's an agent
   grepping a few hundred offline notes (NOT a human-facing search box), KEEP the in-house BM25
   (`brain_search.py` / `bm25.ts`) — do NOT reflexively stand up a server. truffle supersedes in-house BM25
   only for product-facing / multi-tenant / large / quality-visible surfaces.

4. **Route to the default with the honest cost `[O12, O13, O15; TOOL-MATRIX Cat-1]`:**
   - **Meilisearch — the default.** Turnkey, best DX, hybrid-on-by-default (2026), official MCP + CLI (the
     agent-tooling edge). Reach for it for docs/content/MVP/agent-native products.
   - **Typesense — latency + multi-tenancy.** Fastest raw latency, cleanest hybrid API (`query_by:
     "text,embedding"` auto-fuses), best OSS multi-tenancy (HMAC scoped keys). Cost: RAM-bound, fiddly HA
     Raft, **NO official MCP/CLI** (drive via REST) `[P3]`.
   - **Postgres + pg_search + pgvector — "one fewer service."** Most agent-legible (SQL). Cost: you
     hand-roll RRF fusion in SQL, watch the dims/HNSW cap. **This is acorn's box — truffle owns the
     retrieval semantics, acorn provisions the DB** `[O1]`.
   - **Algolia — ONLY when relevance is revenue-critical + budget > engineering time.** Best defaults, zero
     ops. Cost: bills per-query AND per-record — **the WORST fit for a high-internal-query agent**; "bill
     shock at ~1M+ records" is the canonical migration trigger `[O15, S2]`. **Never default an agent product
     to Algolia.**
   - **Elasticsearch / OpenSearch — ONLY at petabyte scale, logs+search-in-one, or heavy aggregations.**
     Accept the 10-issue ops catalog (GC pauses, mapping explosion, shard guesswork, the 10K deep-pagination
     cliff). **Never default to ES for a product search box** `[O13, S13]`. And **never cite the license** as
     a reason to leave ES in 2026 — ES is AGPL again; the real reasons are OPS + COST `[O14]`.

5. **Output a decision, not a survey.** Name the engine, the honest cost, and the right-size verdict. State
   the default and **name any live dispute** (Meili-vs-Typesense as *the* default is corpus-dependent
   `[GAPS DISPUTE C]`) rather than pretending it's settled.

## Output format

```
ENGINE:        <Meilisearch | Typesense | Postgres+pgvector | Algolia | Elasticsearch | OpenSearch | keep-in-house-BM25>
WHY:           <the routing-question answer that drove it>
HONEST COST:   <the real tradeoff — RAM / per-query+record billing / ops weight / hand-rolled fusion / quota>
RIGHT-SIZE:    <is this over- or under-provisioned for the corpus? the explicit verdict>
DISPUTE FLAG:  <any open dispute named, not fake-resolved — e.g. Meili-vs-Typesense default>
```

## Worked example

> **Request:** "We're building search for our internal docs portal — ~500K docs, multi-tenant across
> business units, latency matters. Someone suggested Elasticsearch since it's the standard."

1. Boundary check: this is engine selection (not "provision the pgvector box" → that'd be acorn). Proceed.
2. `truffle engine select --corpus-size 500000 --multitenant --latency-critical --json`
3. Litmus: humans type queries expecting relevance → a real engine, not in-house BM25.
4. Routing: multi-tenant + latency-critical → **Typesense** (best OSS multi-tenancy via HMAC scoped keys +
   fastest latency). ES is **over-provisioned** for a 500K-doc corpus that fits in RAM — recommending it "because
   it's the standard" is the resume-driven trap `[S13]`. The 2021 license fear is dead `[O14]`.

```
ENGINE:        Typesense
WHY:           multi-tenant + latency-critical at 500K docs (fits in RAM); humans type queries expecting relevance
HONEST COST:   RAM-bound (budget RAM ≈ index × 1.5, test the DEPLOY spike, P5); no official MCP/CLI → drive via REST (P3); HA Raft is fiddly (P6)
RIGHT-SIZE:    ES would be over-provisioned (10-issue ops catalog for a corpus that fits in RAM on one box) — Typesense is the right size
DISPUTE FLAG:  Meili-vs-Typesense as the default is corpus-dependent (GAPS DISPUTE C) — chose Typesense here for the multi-tenancy + latency requirement; Meili if agent-tooling/DX dominated
```

Then: the multi-tenancy primitive is a follow-on (`tenant key`, S7) and relevance must be gated behind a
golden set from day one (`search-eval-loop`).
