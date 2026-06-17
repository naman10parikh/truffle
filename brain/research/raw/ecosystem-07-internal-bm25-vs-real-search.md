---
title: "Search Ecosystem — Energy's In-House BM25 vs Real Search Engines (June 2026)"
type: synthesis
created: "2026-06-17"
updated: "2026-06-17"
tags: [search, internal, bm25, wikimem, sentinel, memory-search, truffle, gap]
summary: "What Energy already has (three hand-rolled BM25 / grep search layers) vs what real search engines give you. Establishes exactly the GAP truffle the Search employee fills. Quotes the actual in-house code (read-only)."
researcher: "truffle ECOSYSTEM (CP123 Wave-R)"
---

# Energy's In-House Search vs Real Engines — the GAP truffle fills

> READ-ONLY references quoted below. I did not edit any of these files; they live in other
> repos (energy, sentinel, llmwiki). This file establishes the baseline truffle supersedes.

---

## 1. What Energy has TODAY (three layers, all hand-rolled)

### 1a. `energy/scripts/memory-search.sh` — grep-based "BM25-like" (the weakest)
- It's a Bash script that `grep -ci`s each query term per file and scores:
  `combined = tf_score × source_weight × recency_weight` (lines ~204-205).
- Source weights: rules=5, LEARNINGS=4, topics=4, daily=3, vault=2 (hand-coded, `weight_for_source`).
- Recency weights: ≤1d=10, ≤3d=8, ≤7d=6, … >30d=1 (`recency_weight`).
- HONEST ASSESSMENT: this is NOT BM25. It's term-frequency × hand-tuned multipliers. No IDF
  (rare terms aren't weighted higher), no length normalization (long docs win unfairly), no
  inverted index (it re-greps every file every query → O(files) per search). Fine for a few
  hundred markdown files; falls over at thousands and gives bad relevance (common words
  dominate). The comment even calls it "BM25-like" / "BM25-style" — it's an approximation.

### 1b. `sentinel/access/brain_search.py` — REAL BM25 (the good one)
- A correct pure-Python BM25 (Okapi): computes `idf = log(1 + (N - df + 0.5)/(df + 0.5))`,
  `score = Σ idf × tf×(k1+1) / (tf + k1×(1 - b + b×dl/avgdl))`, k1=1.5, b=0.75 (lines 40-59).
- Self-described: "FREE, deterministic BM25 … No LLM, no API, no quota … pure-Python BM25 over
  the transcript+caption+author of every reel note … Idempotent, instant, offline."
- HONEST ASSESSMENT: this is a TEXTBOOK-correct BM25 and a genuinely good default for a small
  offline corpus (hundreds-to-low-thousands of notes). But: it RE-TOKENIZES the entire corpus
  on EVERY query (`toks = {c: tok(t) for c,t in docs.items()}` line 42 — no persisted inverted
  index), single-field-ish, no faceting, no typo tolerance, no vectors/hybrid, no multi-tenancy.
  Scales linearly with corpus size per query.

### 1c. `llmwiki/src/search/bm25.ts` — TypeScript BM25 with title boost
- Per `tests/bm25.test.ts`: `bm25Search(query, docs)` with `tokenize()` (lowercase, strip
  punctuation, drop tokens ≤2 chars), ranks by relevance, BOOSTS title matches (doc with the
  term in `title` ranks first). Returns sorted-desc scored results.
- HONEST ASSESSMENT: a solid in-process BM25 with a title-boost heuristic — good for WikiMem's
  KB use case. Same structural limits: in-memory, no persistent index, no facets/typo/vector,
  no multitenancy. It's a memory-layer search, not a product search engine.

---

## 2. What these CANNOT do (the capability cliff)
None of the three in-house layers provide:
- **Inverted index / persistence** — all re-scan the corpus per query (O(N) per search). Real
  engines build a persisted index → O(log N)-ish, scale to millions.
- **Typo tolerance** — a user typing `appl macbook` gets nothing. (Typesense/Meili: built-in.)
- **Faceting / filtering** — no `filter_by date>X AND tenant=Y`, no facet counts for UI.
- **Vector / semantic / hybrid** — no embeddings, so "find docs ABOUT auth" (paraphrase) fails.
- **Multi-tenancy** — no per-tenant isolation (Typesense scoped keys, Meili tenant tokens).
- **Reranking** — no two-stage retrieve→rerank quality lift.
- **Real-time index updates at scale, highlighting, synonyms, curation, geo** — all absent.

This maps EXACTLY to the energy checklist line (verified, `audit/HARNESS-CHECKLIST-2026.md`):
> `Search — Typesense / Meilisearch / Algolia (≠ in-process BM25) — GAP`
> `Product · C2 infra | Search | ❌ GAP — only in-process BM25 (wikimem)`

---

## 3. The right boundary (when to use which — don't over-correct)
- **Keep the in-house BM25** for: small, local, offline, zero-dependency corpora — agent
  memory, a few hundred markdown notes, CI-time search, anything where standing up a server is
  overkill. `sentinel/brain_search.py`'s "free, deterministic, offline, no quota" pitch is
  CORRECT for that niche. Truffle should NOT replace these for tiny local use.
- **Use truffle / a real engine** for: any PRODUCT-facing search surface, multi-tenant data,
  thousands+ of docs, when you need typo tolerance / facets / hybrid / reranking / highlighting,
  or when relevance quality is user-visible. This is where hand-rolled BM25 hits the cliff.

The litmus test: *"Does a human end-user (not an agent) type queries into this, expecting
typo-tolerant, faceted, relevance-ranked results?"* → real engine (truffle). *"Is it an agent
grepping its own notes offline?"* → in-house BM25 is fine.

---

## 4. truffle's positioning (the one-liner)
truffle = the Search domain-expert employee that takes Energy from "three hand-rolled BM25
layers good only for tiny offline corpora" to "production hybrid search (BM25 + vector + RRF +
rerank), faceting, typo tolerance, and multi-tenancy" — defaulting to Meilisearch/Typesense
(OSS) or Postgres+pgvector+pg_search ("one fewer service"), with Algolia as the managed option.
It FILLS the `Search ❌ GAP` in the harness checklist, and it does so agent-natively (MCP/CLI/
skills), including potentially building the missing official-quality Typesense MCP.
