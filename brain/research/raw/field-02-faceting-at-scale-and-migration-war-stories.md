---
title: "Field Intelligence — Faceting at Scale & Migration War Stories (June 2026)"
type: source
created: "2026-06-17"
updated: "2026-06-17"
tags: [search, field-intelligence, faceting, high-cardinality, migration, war-stories, elasticsearch, typesense, algolia, vinted]
summary: "Real production faceting pain at scale (Vinted's 600M-item case study, the Elastic global-ordinals problem with hard numbers) + concrete A→B migration war stories (what actually breaks moving Algolia→Typesense). The expensive lessons, quoted with figures."
researcher: "truffle FIELD-INTELLIGENCE (CP123 Wave-R)"
---

# Faceting at Scale & Migration War Stories — the expensive lessons

---

## 1. Faceting at scale: the Vinted production case study (the gold standard)

**Source:** Vinted Engineering, *Faceted search using Elasticsearch*, 2023-03-21 —
https://vinted.engineering/2023/03/21/faceted-search-using-elasticsearch (accessed 2026-06-17).
This is a REAL operator postmortem-style writeup, not a vendor blog. I trust it despite the
2023 date because the engineering constraints (global ordinals, high-cardinality fields,
multi-select facet math) are structural and unchanged in 2026 — and it's the most-cited
faceting-at-scale case study in practitioner writing.

### The scale (so you know these numbers are real, not toy)
- **"almost 600 million unique items"**
- **"more than 2,000 search requests per second"**
- Product requirement: **"calculate facet counts for up to 500 items, with any count above
  500 represented as '500+'"** (a deliberate cap — they DON'T compute exact counts past 500,
  because exact high counts are expensive and users don't care past "500+").

### The pain that bit them — verbatim
- **High-cardinality latency:** the brand field "initially had a cardinality of 2,000,000,
  which was causing latency issues." **Reducing it to 40,000 verified brands decreased P99
  latency by approximately 15ms.** → LESSON: high-cardinality facet fields are a latency tax;
  curating/reducing cardinality (2M → 40K) is a legitimate fix, not a hack.
- **Multi-select facet complexity:** when a user selects a filter, you must still show counts
  for the UNSELECTED options of that same facet — which "requires separate queries per facet
  that excluded only the current facet's filter." This is the multi-select facet math that
  every faceted UI eventually hits and most people get wrong on the first try.

### The architectural tradeoffs they made (these ARE the taste — each is a tradeoff, not a win)
- **Separate vs. combined aggregation requests:** they chose **"Option 2: Sending
  aggregations in separate Elasticsearch requests" despite "20% higher CPU usage on
  Elasticsearch" because the item search was "~71ms faster."** → They bought query latency
  with CPU. Explicit tradeoff, chosen deliberately.
- **Shard strategy:** they REJECTED separate indices "despite observing that 'smaller shards
  resulted in better latency'" — to avoid "2x more disk space usage and additional
  complexities." → Smaller shards = faster but more disk + ops; they chose the simpler/cheaper
  side knowingly.
- **Cache-consistency tradeoff (the spicy one):** they "simplified queries by removing the
  user ban filter, increasing cache hit ratio by 5%, acknowledging this would cause users to
  'see counts from banned users.'" → They accepted SLIGHTLY WRONG facet counts (counting
  banned users) to buy a 5% cache-hit improvement. This is the kind of pragmatic
  correctness-vs-performance call great search engineers make and average ones won't.

### The result (the goalposts they hit)
- **"~120ms P99 latency and ~16ms average latency"** (requirement was "less than 150ms").
- Cache hit ratio **"approximately 50%"** (with dynamic cache duration: 0 to 1 day based on
  result-set size).
- Optimization toolkit they applied: `size: 0` for aggregation-only requests; `terminate_after`
  limited to 100,000 docs; brand facets capped to "top 50"; dynamic cache duration by result
  size.

> TASTE TAKEAWAY for truffle: faceting is where "search" stops being a query problem and
> becomes a *systems* problem (CPU vs latency vs disk vs cache vs correctness). truffle's
> faceting story can't be "we support facets" — it has to encode these tradeoff dials
> (cardinality reduction, separate-vs-combined aggs, `terminate_after`, count caps like
> "500+", multi-select facet exclusion). An agent building faceted search MUST be told these
> exist or it'll ship the naive O(cardinality) version that dies at scale.

---

## 2. Why faceting at scale is fundamentally hard (the engine-level "why")

### Elasticsearch: the global-ordinals tax
- Elastic's own engineering: **"the performance of terms aggregations on high-cardinality
  fields may be slow and unpredictable in-part because of the time taken to build global
  ordinals"** — a per-shard incremental numbering of every unique term, rebuilt as data
  changes. (Elastic Blog, *Improving the performance of high-cardinality terms aggregations*,
  https://www.elastic.co/blog/improving-the-performance-of-high-cardinality-terms-aggregations-in-elasticsearch.)
- Real-world severity from the Elastic discuss forum: faceting on tags took performance **"from
  over 400 QPS to 20-30 QPS, with average latency jumping from 40 ms to 500 ms."** (discuss.elastic.co
  *Performance killed when faceting on high cardinality fields*,
  https://discuss.elastic.co/t/performance-killed-when-faceting-on-high-cardinality-fields/7809.)
  → A 13-20× throughput collapse and 12× latency blowup from turning on one facet. This is the
  number to remember when someone says "just add a facet."
- Documented mitigations (Elastic): reduce cardinality (the Vinted 2M→40K move = ~15ms);
  `terminate_after` to cap docs/shard; small `size` on terms aggs; columnar single-pass
  architectures "represent an order of magnitude improvement."

### Postgres / ParadeDB: faceting on a row store is structurally worse
- ParadeDB's framing (*Teaching Postgres to Facet Like Elasticsearch*,
  https://www.paradedb.com/blog/faceting, accessed 2026-06-17) — the honest taste:
  > **"faceting _looks_ simple: it's just grouping and counting. But try to make it fast in a
  > traditional row-based database, and you'll run into serious performance challenges."**
  > **"That duality, returning ranked search hits _and_ category counts, is what makes faceting
  > so powerful. It's also what makes it tricky to implement efficiently in a database built
  > for rows, not documents."**
- Their numbers: Postgres's built-in `tsvector` is **"27x slower at 200,000 results"** vs
  ParadeDB's BM25; ParadeDB's MVCC-accurate faceting got **"roughly 40% faster"** as of v0.22.0;
  with MVCC disabled, "well over an order of magnitude improvement" at scale.
  → CAVEAT: these are ParadeDB-vs-vanilla-Postgres numbers (vendor, on their own product), NOT
  ParadeDB-vs-Elasticsearch (no direct ES comparison given). Treat the *direction* (row stores
  struggle at faceting; columnar/document stores win) as solid; the exact % as vendor-flavored.

> TASTE TAKEAWAY: "faceting is just GROUP BY + COUNT" is the naive mental model that dies at
> scale. The real model is "a columnar/inverted-index single-pass over the matched set, with
> cardinality, MVCC-correctness, and per-facet exclusion all as cost dials." This is exactly
> the cliff Energy's in-house BM25 can't approach (no faceting at all — see ecosystem-07).

---

## 3. Migration war stories: Algolia → Typesense (what ACTUALLY breaks)

**Source:** Typesense official *Migrating from Algolia* guide
(https://typesense.org/docs/guide/migrating-from-algolia.html, accessed 2026-06-17) — it's a
vendor doc, but it's the vendor RECEIVING the migration honestly enumerating the breakages, so
it's a good "what breaks" inventory. Cross-referenced with community sentiment (below).

The concrete breakages (each is a real gotcha an agent migrating would hit):
1. **APIs are "not wire-compatible with each other by design."** You cannot swap endpoints;
   every line touching the search API gets rewritten. (No drop-in at the API layer.)
2. **Schema/type strictness flips.** Algolia ALLOWS mixed types for the same field across
   records (`"timestamp": "string"` in one doc, `"timestamp": 123` in another). Typesense
   REQUIRES consistent types. → Dirty Algolia data that "worked" will be REJECTED by Typesense
   unless you use `coerce_or_reject` on import or auto-schema detection. This is the #1 silent
   migration failure: your data was never as clean as Algolia let you pretend.
3. **Write model flips async → sync, but with a catch.** Algolia = async writes (poll to
   confirm). Typesense = synchronous (success = indexed immediately) — EXCEPT under high-volume
   ingestion it returns **`HTTP 503 Lagging or Not Ready`**, "forcing retry logic with
   backoff." → You trade Algolia's polling for Typesense's 503-backoff. Agents bulk-importing
   MUST implement 503 retry/backoff or they'll silently lose writes.
4. **ID field rename:** Algolia `objectId` → Typesense `id`. Remap on export/import.
5. **Timestamp format:** Algolia accepts ISO8601; Typesense needs **Unix epoch** for sorting.
   Forget this and your sorts silently break.
6. **Terminology + auth:** "Indexes" → "Collections"; `Application ID + API Key` →
   `x-typesense-api-key`. Affects every path.
7. **A WIN that removes complexity:** Algolia needs *virtual replica indices* per sort order
   (price-asc vs price-desc = two indices); Typesense does multi-sort in ONE collection via
   dynamic `sort_by`. → Migration actually simplifies your sort architecture.
8. **Features that DON'T migrate (you lose or rebuild):**
   - Server-side A/B testing (Typesense: client-side workaround).
   - Dynamic synonym suggestion out-of-the-box.
   - Built-in event tracking + user personalization (Typesense: bring your own ML).
   - Out-of-the-box recommendations (Typesense: vector search + external ML).
   → If you rely on Algolia's analytics/personalization/AB layer, that's NOT a migration, it's
   a rebuild. This is the hidden cost migration-cost-savings posts omit.

### Migration timeline reality (community, directional — vendor-adjacent sources)
- Median Algolia→Typesense migration: **2–3 weeks.** With the InstantSearch UI adapter (reusing
  frontend components): **30 min – 1 hour** for the UI layer; the DATA + features layer is the
  real work. (Typesense docs + meilisearch.com/blog/typesense-review.)
- HN sentiment (cited via WebSearch synthesis of HN Typesense threads): one commenter described
  it as **"the rare open-source replacement that really is a drop-in replacement — I swapped an
  Algolia integration in a weekend."** On r/webdev "the most common migration story is Algolia →
  Typesense once record counts cross the low seven figures and Algolia pricing stops being
  palatable." → NOTE: I could not open these specific HN/Reddit comment permalinks to verify the
  exact wording (they came via search-engine synthesis, not a direct fetch). Flagged for
  GAPS-AND-DISPUTES; treat the *pattern* (people DO migrate at ~1M+ records over price) as
  well-attested, the *exact quote* as second-hand.

---

## 4. The migration trigger (why people leave Algolia) — the economics, quoted

The dominant migration driver is COST at scale, not features:
- **"Many users report bill shock when their search volume grows, with costs escalating from
  hundreds to thousands of dollars monthly."** Algolia's model bills on BOTH search requests AND
  records stored, "which can lead to unpredictable costs as usage scales." (meilisearch.com/blog/algolia-pricing
  [Jun 2025] — VENDOR-ADJACENT, framing.)
- **"What starts as an affordable tool can quickly strain your budget."** (meilisearch.com/blog/algolia-review.)
- The structural mismatch for OUR use case: Algolia's per-query model "punishes high-volume
  internal querying — exactly what an agent does." (My synthesis, consistent with ecosystem-06.)
  → An AGENT that queries search thousands of times per task is the WORST possible fit for
  per-query pricing. This is a real architectural reason truffle should default to flat-cost
  self-host (Meili/Typesense/Postgres), not Algolia, for agent-driven internal search.
- Reported savings switching Algolia → Typesense Cloud: **"50% to 95%"** (directional, from
  comparison blogs). Typesense "no per-record or per-search charges … throw as much traffic or
  data at your cluster as it can handle." (typesense.org comparison + buildmvpfast.com/api-costs/search.)

> THE NUANCE practitioners miss: the cost saving is real, but it's a TRADE — you take on ops
> (you run the box, you handle the 503-backoff, you rebuild A/B + personalization, you size RAM
> for the in-memory index). The honest framing: "Algolia is expensive but you pay for someone
> else to run + tune it; self-host is cheap but YOU now own relevance tuning, ops, and the
> features Algolia gave you free." Migration-savings posts almost never price in the rebuild.

---

## 5. 2026 invalidates 2025 (faceting + migration currency)
- **ParadeDB `pg_search` made "facet in Postgres" newly credible (2026).** As of v0.22+/v0.24
  (Jun 2026), MVCC-accurate faceting + BM25 in Postgres is real — so the 2024 answer "you can't
  facet well in Postgres, use Elasticsearch" is now softened to "you can, with ParadeDB, at
  small-mid scale, knowing JOIN/non-latin/ORM are young" (cross-ref ecosystem-03 §5).
- **The Algolia→Typesense migration got easier (InstantSearch adapter maturity)** — the UI
  layer is now 30-min work; but the FEATURE-PARITY gap (A/B, personalization, recommendations)
  is the same or wider as Algolia adds more managed ML. So "migration got easier" is true for
  the plumbing, false for the value-added layer.

---

## 6. Sources (this file)
- Vinted Engineering, *Faceted search using Elasticsearch*, 2023-03-21 (PRIMARY case study) —
  https://vinted.engineering/2023/03/21/faceted-search-using-elasticsearch
- Elastic Blog, *Improving the performance of high-cardinality terms aggregations in
  Elasticsearch* — https://www.elastic.co/blog/improving-the-performance-of-high-cardinality-terms-aggregations-in-elasticsearch
- discuss.elastic.co, *Performance killed when faceting on high cardinality fields* (the 400→20
  QPS thread) — https://discuss.elastic.co/t/performance-killed-when-faceting-on-high-cardinality-fields/7809
- ParadeDB, *Teaching Postgres to Facet Like Elasticsearch* —
  https://www.paradedb.com/blog/faceting
- Typesense docs, *Migrating from Algolia* — https://typesense.org/docs/guide/migrating-from-algolia.html
- Meilisearch blog (VENDOR-ADJACENT, framing/economics): algolia-pricing [Jun 2025],
  algolia-review, typesense-review.
- buildmvpfast.com, *Search Pricing Comparison (June 2026)* — https://www.buildmvpfast.com/api-costs/search
- All accessed 2026-06-17.
