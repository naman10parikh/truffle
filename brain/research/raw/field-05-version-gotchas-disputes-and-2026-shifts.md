---
title: "Field Intelligence — Version-Specific Gotchas, Disputes & 2026-Invalidates-2025 (June 2026)"
type: synthesis
created: "2026-06-17"
updated: "2026-06-17"
tags: [search, field-intelligence, version-gotchas, disputes, currency, typesense-v28, meilisearch, llm-judge, gaps]
summary: "Dated, verbatim version-specific war stories from fresh 2025-2026 GitHub issues (Typesense v28 silently broke typo tolerance; v28 EKS DNS crashes; facet sampling; Meili arroy→hannoy vector-backend churn + delta-bitmap), the open disputes captured both-sides (incl. Turnbull's 2025 LLM-judge skepticism), the consolidated 2026-invalidates-2025 list, and the X-signal status. Feeds GAPS-AND-DISPUTES."
researcher: "truffle FIELD-INTELLIGENCE (CP123 Wave-R)"
---

# Version Gotchas, Disputes & What 2026 Changed

> CURRENCY ANCHOR (gh-api-verified 2026-06-17): **Typesense latest = v30.2 (2026-04-19)**
> [also v29.1 2026-04-19; v30.0 2026-01-27]; **Meilisearch latest = v1.47.0 (2026-06-15)**
> [v1.46.x 2026-06]. These are <6 months old; the gotchas below are tied to specific tags.

---

## 1. VERSION-SPECIFIC WAR STORIES (dated, verbatim, from fresh GitHub issues)
These are the "this exact version broke this exact thing" stories — the most useful kind for an
agent, because they're reproducible and tag-pinned. All via `gh api repos/.../issues`, 2026-06-17.

### 1a. Typesense v28 SILENTLY BROKE typo tolerance (#2313, 2025-04-24, 14💬, OPEN)
Verbatim user report:
> "We've upgraded to the latest version (v28), and since then, we've been experiencing an issue
> with typo tolerance… even the smallest typos—like using a 'd' instead of a 't'—result in zero
> matches. Previously, these kinds of typos were handled correctly. We tried increasing the typo
> tolerance parameters, but that didn't make any difference."
- WHY IT MATTERS: typo tolerance is THE headline feature of Typesense/Meili vs Elasticsearch.
  A minor-version upgrade silently regressed it, and bumping the typo params didn't fix it. This
  is the nightmare scenario: a "safe" upgrade quietly degrades your core UX with no error.
- AGENT RULE for truffle: NEVER treat a search-engine version bump as a no-op. After ANY upgrade,
  re-run the typo-tolerance golden tests (single-char substitution, transposition, multi-word
  typo) BEFORE shipping. This is concrete evidence for the "search is never done" eval loop.
- Source: https://github.com/typesense/typesense/issues/2313 (accessed 2026-06-17)

### 1b. Typesense v28.0 EKS pods crash ~hourly on DNS (#2208, 2025-02-19, 22💬, closed)
A real K8s production crash. Verbatim user (@maltoe):
> "we're trying out the new v28.0 release and are experiencing seemingly random but frequent
> (like once per hour) crashes of our Typesense pods in AWS EKS."
> Logs: `[E112]Not connected to 10.10.13.49:8107 yet` … `Fail to wait EPOLLOUT … Connection
> timed out [110]`.
Maintainer **@kishorenc** reply (verbatim):
> "Seems like a DNS resolving issue? **Running Typesense on Kubernetes requires some care.** I
> recommend using this community maintained operator: …Typesense-Kubernetes-Operator."
User's diagnosis (verbatim): the crashed pod couldn't resolve `typesense-0.typesense-peering.
typesense.svc.cluster.local` because "K8s had temporarily removed the DNS record from the
headless service" during the rolling update — "We had these messages with v27 as well during
re-deploys, and they would resolve over time."
- WHY IT MATTERS: confirms ecosystem-03's "Typesense HA cluster is a real project" with a DATED,
  verbatim incident + the MAINTAINER admitting "K8s requires some care." The Raft peering +
  headless-service DNS is fragile during rolling updates.
- AGENT RULE: on K8s, use the community Typesense operator, not a hand-rolled StatefulSet; expect
  transient peering errors during rolling deploys and ensure they self-heal (don't crash-loop).
- Source: https://github.com/typesense/typesense/issues/2208 (accessed 2026-06-17)

### 1c. Typesense hybrid + `symbols_to_index` produces wrong scores (#2365, 2025-05-15, 21💬, OPEN)
Verbatim:
> "When using `symbols_to_index` together with a hybrid search, the results text scores are not
> correct… When added the `symbols_to_index`, the ranked documents make even less sense, the
> highlights are completely wrong and there's no `text_match_info`."
- The user's exact use case is OURS: "a code reference and a title… user introduces the reference
  in the text, and the record with that reference [should] appear at the beginning." → indexing
  CODE/IDENTIFIERS (which need symbols indexed) + hybrid search = a known broken combo.
- WHY IT MATTERS: this is the SKU/code/API-name failure class (field-01) hitting a SECOND way —
  even when you correctly try to index symbols, the hybrid score fusion goes wrong. Directly
  relevant to truffle indexing technical/code content.
- Source: https://github.com/typesense/typesense/issues/2365 (accessed 2026-06-17)

### 1d. Typesense prefix-search casting bug (#2658, 2025-11-05, 17💬, OPEN, v0.28)
> "When users search for 'S', only return movies whose name starts with 'S' (prefix match on
> title). If there is no match in name, then fall back to casting." — but prefix search returns
> secondary-field (casting) results "even when `prefix=false` and `query_by_weights` are applied."
- The multi-field prefix + weighting + fallback interaction is fiddly; declaring weights/prefix
  doesn't behave as the docs imply. (Same theme as Meili's attribute-declaration footguns,
  ecosystem-03 §1.) AGENT RULE: test multi-field prefix behavior explicitly; don't trust the
  weight knobs to do what the name suggests.
- Source: https://github.com/typesense/typesense/issues/2658 (accessed 2026-06-17)

### 1e. Meilisearch vector-backend SWAP: arroy → hannoy (#5767, 2025-07-21) + delta-bitmap (#5985, 2025-11-10)
- **arroy→hannoy:** Meili added "an index setting that allow migration from arroy to hannoy (and
  back)" — i.e., they're swapping the underlying ANN vector index implementation, behind an
  experimental flag. (https://github.com/meilisearch/meilisearch/issues/5767.)
- **delta-encoded bitmap (#5985):** "the size of the word-docids database was reduced by half
  (yes, 50%)… word-prefix-docids reduced by 30%… the engine will NOT convert your [existing data
  automatically]." (https://github.com/meilisearch/meilisearch/issues/5985, 24💬, OPEN.)
- WHY IT MATTERS: Meili is actively churning its on-disk + vector internals in LATE 2025. Two
  implications: (1) the vector backend is still maturing (arroy was itself new; now hannoy) — so
  Meili vector behavior/perf can shift between minors; (2) storage-format changes may NOT
  auto-migrate, so a version bump can leave you on the old (larger/slower) format until you
  reindex. AGENT RULE: read Meili minor-version changelogs for storage/vector changes; plan a
  reindex to get new-format benefits; don't assume an upgrade transparently improves vectors.
- The genuine positive: a 50% index-size cut is a big deal for the RAM-bound deploy spikes
  (ecosystem-03 #5616) — but only after reindex.

> META-PATTERN across 1a–1e: **the fast OSS engines (Typesense, Meili) move quickly and
> occasionally regress core behavior (typo tolerance, hybrid scoring, prefix) across minors, and
> change internals (vector backend, storage format) that don't auto-migrate.** This is the price
> of their velocity vs Elasticsearch's slower-but-stabler cadence. truffle MUST own a version-bump
> regression suite — this is the strongest concrete justification for the "search is never done"
> eval loop being built into the harness, not optional.

---

## 2. The facet-performance contradiction (a real dispute, with the resolution)
ecosystem-06's headline scorecard says **Typesense = fastest**. But Typesense's OWN issue #914
(*Performance problem (facets)*, OPEN, 43💬) is a user reporting the OPPOSITE for FACETS:
> "I specifically tested meilisearch, and typesense and **meilisearch handle it much, much
> better** [for facets on 100,000+ results]. At times it is a reprint 5-10 times."
Maintainer **@kishorenc** resolution (verbatim, the actual fix):
> "In v0.25 RC builds, we have an estimation option available for facets… `facet_sample_threshold:
> 100000`, `facet_sample_percent: 10`. If at least 100000 hits are found… we will use 10% of the
> hits to estimate facet counts." (And the InstantSearch adapter exposes these via
> `additionalSearchParameters`.)
- THE NUANCE: "Typesense is fastest" is true for QUERY latency but NOT automatically for
  high-cardinality FACET counting on huge result sets — there Typesense had to add SAMPLING
  (approximate counts) to compete, and at least one user found Meili better at exact facets at
  scale. → "Fastest engine" is dimension-specific; faceting is a separate axis from query speed.
- AGENT RULE: if truffle needs facets over 100K+ matched docs, use `facet_sample_*` on Typesense
  (accept APPROXIMATE counts for speed — same tradeoff as Vinted's "500+" cap, field-02 §1), and
  benchmark Meili as a serious alternative for exact facets. Don't assume "fastest engine = best
  facets."
- Source: https://github.com/typesense/typesense/issues/914 (accessed 2026-06-17)

---

## 3. Open disputes (both sides verbatim — additions to GAPS-AND-DISPUTES)
(ecosystem-08 already captured: "just use Postgres" vs dedicated engine; Typesense vs Meili
default; self-host vs managed break-even. field-01 added: ES-still-right-bet; RRF-enough vs
tuned-tiers; rerank-vs-fusion-biggest-lever. These are NEW.)

### Dispute D — "Is LLM-as-judge a shortcut for search relevance eval, or a trap?" (HOT in 2025-26)
- **The HYPE side** (common in 2025-26 RAG/eval tooling): use an LLM to score query→doc relevance
  at scale, skipping expensive human labeling — "LLM judges let you eval relevance cheaply."
- **Doug Turnbull, *LLM Judges aren't the shortcut you think* (2025-11-02), verbatim NO:**
  > "LLM judges aren't the shortcut teams hope. Instead, they are themselves a thing that needs
  > data and monitoring to get use out of."
  > "That last bit of human-LLM disagreement matters. Those are the non-obvious cases." (the
  > critical ~10% — hard negatives/edge cases.)
  > LLMs "excel at topical relevance but miss what actually engages users — the 'lizard brain'
  > factors driving real conversions."
  > His prescription: use LLMs for **feature generation, not final judgment**; feed outputs into
  > traditional ML ranking / Learning-to-Rank; "comprehensive human labeling isn't eliminated by
  > LLM judges — it becomes even MORE essential."
  (https://softwaredoug.com/blog/2025/11/02/llm-judges-arent-the-shortcut-you-think)
- **UNRESOLVED / truffle stance:** captured both sides. For truffle this is load-bearing — an
  agent-native search employee will be TEMPTED to LLM-judge its own relevance (it's an LLM). The
  field's leading voice says: LLM-judge is an INPUT, not the eval ground truth; keep a
  human-labeled (or behavior/engagement-derived) golden set as the real gate. Lean Turnbull's
  way, but flag it as genuinely contested.

### Dispute E — "Is search even a separate discipline anymore, or just LLM query-understanding?"
- **Turnbull (2025, "all search is structured now"):** the future is LLM query-understanding +
  structured retrieval; engine-knob-tuning is fading. (field-04 §1b.)
- **The hybrid/relevance traditionalists (TianPan, Pureinsights, the WANDS-tuning camp):** the
  durable skill is still fusion + reranking + per-query relevance tuning on YOUR corpus; LLMs
  help the QUERY side but the RETRIEVAL/ranking craft is unchanged.
- **Synthesis:** not actually opposed — LLMs reshape the QUERY-understanding front-end; the
  retrieval/fusion/rerank/eval back-end craft persists. But there's real tension about where the
  VALUE concentrates (front-end query understanding vs back-end ranking). Flagged.

---

## 4. 2026-INVALIDATES-2025 — the consolidated currency ledger
(Merges field-01 §5, field-02 §5, field-03 §5 into one list for GAPS-AND-DISPUTES; the single
"what's different now" reference.)
1. **"Vector DB as a moat" is dead** (peaked 2023; "a feature, not a moat" by 2026 —
   Pureinsights). Don't stand up a dedicated vector DB *solely* for semantic search.
2. **"Vectors killed keyword search" is the named strategic error of the era.** 2026 default =
   hybrid (BM25+vector+RRF+rerank), full stop.
3. **The bar moved from "do you do hybrid" → "do you TUNE the fusion + name the failure modes."**
   "We do RRF" is 2025 table stakes; +7.5%-tuned-vs-+1.3%-naive is the 2026 differentiator.
4. **Reranking went from optional → assumed** (the default 2026 pipeline includes a cross-encoder
   rerank of top-100).
5. **MTEB credibility eroded further** — "a prior, not an oracle"; an MTEB-#11 model beating the
   top-3 on a real legal corpus is the canonical 2026 cautionary tale.
6. **Open embedding/reranker models reached parity** — closed-vs-open is now a compliance/ops
   decision, not a quality one. "OpenAI embeddings are just better" is a 2023 reflex.
7. **ES license fear is OVER** (AGPL again) — "we left ES over licensing" is a 2021 reason that
   no longer applies; current reasons to leave are purely OPS + COST.
8. **"You NEED Elasticsearch for BM25+faceting" moat narrowed** — ParadeDB `pg_search` (v0.24,
   Jun 2026) made credible BM25+facets-in-Postgres real at small-mid scale; the set of workloads
   that JUSTIFY ES ops weight shrank.
9. **LLM-as-judge for relevance eval went from "obvious win" → "contested"** (Turnbull's
   2025-11 pushback) — the 2025 assumption that LLM judges replace human labels is now disputed.
10. **"All search is structured now"** (Turnbull 2025) — cheap local LLMs flipped query
    understanding from expensive-specialist-work to a default pre-step; the 2024 "LLM query
    understanding is too slow/expensive" reasoning is dead.

---

## 5. X / Twitter signal — STATUS: ATTEMPTED, BLOCKED (transparent)
Per mission HARD RULE 6, I tried X via the sanctioned in-house path
(`energy/scripts/x-content-intel/scrape.py` + `~/.claude/x-auth/x-session.json`):
- **Auth loaded successfully** (cookies valid: "Auth loaded. Scraping…").
- **Targeted SEARCH endpoint returned HTTP 404** — the script's hardcoded `SEARCH_DOC_ID`
  (`MJpyQGqgklrVl_6rYKQbow`) is a STALE GraphQL persisted-query hash (X rotates these; the search
  query ID is out of date). So I could NOT run a targeted "Elasticsearch/Typesense/Meili/relevance"
  X search.
- **Home timeline DID work** (35 tweets) but it's the chairman's PERSONAL For-You feed; scanned it
  for search-infra keywords → **1 nominal hit, a false positive** (a Cursor code-hosting launch,
  matched on "review/collaborate"), **0 genuine search-infra practitioner content.**
- **CONCLUSION:** X-targeted practitioner signal is UNAVAILABLE this session (stale search doc_id),
  and the home feed has no relevant content. Per the mission's fallback clause, I relied on
  HN/Reddit/GitHub/engineering-blogs (all the above). FOLLOW-UP for a future run: refresh the
  `SEARCH_DOC_ID` in scrape.py from a live X session (these hashes change every few weeks), then
  re-run `python3 scrape.py --search "Elasticsearch Typesense Meilisearch relevance"`.
- Evidence saved: /tmp/truffle-x-search1.json (0 tweets, 404), /tmp/truffle-x-home.json (35 tweets,
  no relevant content). [Note: /tmp artifacts are ephemeral; the finding is recorded here.]

---

## 6. Sources (this file)
- GitHub issues (gh-api-verified 2026-06-17): Typesense #2313 (typo v28), #2208 (EKS DNS v28),
  #2365 (symbols_to_index hybrid), #2658 (prefix casting), #914 (facet perf + sampling fix);
  Meilisearch #5767 (arroy→hannoy), #5985 (delta-bitmap). URLs:
  https://github.com/typesense/typesense/issues/{2313,2208,2365,2658,914} ,
  https://github.com/meilisearch/meilisearch/issues/{5767,5985}
- Doug Turnbull, *LLM Judges aren't the shortcut you think* (2025-11-02) —
  https://softwaredoug.com/blog/2025/11/02/llm-judges-arent-the-shortcut-you-think
- Doug Turnbull, *All search is structured now* (2025-04-02) —
  https://softwaredoug.com/blog/2025/04/02/all-search-structured-now
- Doug Turnbull, *Why Your Search Relevance Project Will Fail* (talk; "search as a constant
  experimentation cycle", "relevance as product") — https://www.youtube.com/watch?v=Ms9QBBB8MxE
- Vector Podcast (RSS.com), Turnbull "Search as a constant experimentation cycle" —
  https://rss.com/podcasts/vector-podcast/638830/
- Release versions: `gh api repos/typesense/typesense/releases` (v30.2 2026-04-19),
  `gh api repos/meilisearch/meilisearch/releases` (v1.47.0 2026-06-15).
- X attempt artifacts: /tmp/truffle-x-search1.json, /tmp/truffle-x-home.json (this session).
- All accessed 2026-06-17.
