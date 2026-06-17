---
title: "Field Intelligence — Explicit TASTE: Opinions Great Search Practitioners Hold (June 2026)"
type: synthesis
created: "2026-06-17"
updated: "2026-06-17"
tags: [search, field-intelligence, taste, opinions, relevance-engineering, turnbull, embeddings, reranking, quotes]
summary: "The quotable, load-bearing OPINIONS that separate great search engineers from average ones — verbatim where possible, attributed. Doug Turnbull on why search orgs fail + 'all search is structured now', embedding-choice taste (MTEB is a prior not an oracle), reranker taste (when NOT to). This is the 'taste' deliverable: what experts believe that beginners don't."
researcher: "truffle FIELD-INTELLIGENCE (CP123 Wave-R)"
---

# Explicit TASTE — what great search practitioners believe that average ones don't

> This is the deliverable the mission calls "explicit TASTE — opinions great practitioners hold
> that average ones don't (quote them)." Each entry is an OPINION (not a fact), attributed, with
> the contrarian/non-obvious edge made explicit. These are the lines truffle's SOUL/skills should
> internalize so an agent doing search work has *taste*, not just capability.

---

## 1. Doug Turnbull — the dean of relevance engineering (ex-Reddit, Spotify, Apple/Meta coaching)
Doug Turnbull is Principal Engineer at Daydream; formerly Principal Engineer at **Reddit**, Staff
Relevance Engineer at **Spotify**, CTO at OpenSource Connections; co-author of *Relevant Search*
(Manning). When he has an opinion about search, it's the closest thing the field has to gospel.
Sources: softwaredoug.com (2023 + 2025 essays), accessed 2026-06-17.

### TASTE 1a — "Search relevance is an ORG problem, not a tech problem" (the #1 contrarian take)
From *One big reason search teams fail* (https://softwaredoug.com/blog/2023/07/08/why-search-orgs-fail):
> **"The thing that more often than not gets in the way is 'politics'. Or more concretely:
> costly, unnecessary coordination between teams."**
> Bad team org leads to "meetings, friction, disengagement, escalation, poor implementations,
> fighting, heroism, and burnout."
- The non-obvious edge: beginners think "we'll fix search by picking the right engine / better
  embeddings / a reranker." Turnbull says the binding constraint is almost always
  ORGANIZATIONAL — who owns relevance, can they ship end-to-end, or must they beg three teams.
- His prescription, verbatim: **"Devs must fully own their own feature soup-to-nuts, regardless
  of what repo it lives in."** Feature work takes "ten times" longer through functional silos.
- And the hiring taste: **"Avoid status seekers. Willingness to be low status is a predictor of
  success."** Hire people who "get shit done" and enable others; not territorial gate-keepers.

> truffle implication: the BIGGEST search risk is rarely the engine choice. An agent-native
> search employee is interesting precisely because it COLLAPSES the org problem — one agent owns
> relevance soup-to-nuts (index → query → tune → eval → re-tune), no cross-team coordination tax.
> Turnbull's "politics is the bottleneck" is the strongest argument FOR an autonomous search
> employee. (This is a genuinely original framing for truffle's pitch.)

### TASTE 1b — "All search is structured now / search is never unstructured" (2025 thesis)
From *All search is structured now* (https://softwaredoug.com/blog/2025/04/02/all-search-structured-now):
> **"search is never unstructured"** — treating queries as raw unstructured strings "was
> fundamentally misguided." The economics flipped: query enrichment that "required expensive
> specialists and months of investment in classifiers and knowledge graphs" is now done by
> **"accessible local LLMs … with minimal cost and effort."**
> **"It's not clear why you WOULDN'T do this right now."**
> Teams that don't risk irrelevance as **"most developers will have moved to a new way of
> thinking"** — from tuning engine knobs to LLM-based query structuring.
- The non-obvious edge: in 2024 the smart take was "LLM query understanding is too slow/expensive
  for prod." Turnbull (2025) says that reasoning is dead — cheap local LLMs make query
  understanding (intent, entity extraction, structured-filter inference) a default pre-step.
- truffle implication: the modern search pipeline isn't "string → BM25+vector → results." It's
  "string → **LLM query-understanding** (extract filters, intent, entities) → structured hybrid
  query → fusion → rerank → results." An agent IS the query-understanding layer Turnbull
  describes — truffle is natively positioned to do the thing he says everyone will move to.

### TASTE 1c — the relevance-whack-a-mole law (from the HN canon, field-01)
> **"The biggest trap people fall into is tuning for one or a few 'pet' queries"** — perfecting
> one query "can have cascading effects downstream that mess up the bulk of your other queries."
> (HN, *What every software engineer should know about search*, id=15231302.)
- The non-obvious edge: relevance is a GLOBAL optimization. Every "fix" for a complaint query is
  a potential regression for 1,000 silent queries. Average engineers tune to the loudest
  stakeholder's pet query; great ones gate every change behind a corpus-wide eval set.

---

## 2. The embedding-choice taste — "MTEB is a prior, not an oracle"
Sources: zc277584121.github.io *Which Embedding Model Should You Actually Use in 2026?* (2026-03-20);
tensoria.fr *8 Embedding Models Compared for Production RAG [2026]*; app.ailog.fr embedding guides.
Accessed 2026-06-17.

### TASTE 2a — leaderboard rank ≠ your rank (the killer anecdote)
> On a **legal-contract retrieval system for a mid-size law firm**, the **MTEB leaderboard
> top-3 models ranked 5th, 7th, and 2nd** on the in-domain eval set of 200 queries. The model
> that WON on that data — **BGE-large-en-v1.5 — was ranked 11th on MTEB** at the time.
> **"MTEB is a useful prior, not a decision oracle."** "MTEB scores don't always translate to
> real-world performance."
- The non-obvious edge: beginners pick the embedding model by sorting the MTEB leaderboard
  descending. Experts treat MTEB as a SHORTLIST GENERATOR, then run the candidates on their own
  200-query golden set — and routinely find an MTEB-#11 model wins on their domain. (Cross-ref:
  ecosystem-08 §2 independently flags MTEB as "gameable/overfit; a 5-pt gap ≈ 3-8% real recall.")

### TASTE 2b — "start with the boring default, only fine-tune when the gap is MEASURED"
> **"Most teams should start with OpenAI text-embedding-3-small or BGE-large-en-v1.5, measure
> retrieval quality on a domain-specific eval set, and only invest in fine-tuning when the gap
> is measurable and the business case justifies the overhead."** Fine-tuning shows **+10–30%
> gains for specialized domains (legal, medical, code)** — but it's the LAST lever, not the first.
- The non-obvious edge: the instinct to fine-tune embeddings early is usually premature
  optimization. The taste: boring default → measure → fuse+rerank (cheaper, bigger lift) →
  ONLY THEN fine-tune embeddings if a measured gap remains in a domain that justifies it.

### TASTE 2c — "closed-vs-open is a COMPLIANCE decision in 2026, not a quality one"
> **"The closed vs open decision in 2026 is not primarily a performance decision — it is an
> operational and compliance decision. Open-source models now match closed-source on retrieval
> quality across most domains."**
- The non-obvious edge: in 2023 "OpenAI embeddings are just better" was defensible. In 2026 the
  open models (BGE, Jina, Nomic, etc.) match closed on most domains, so the decision axis moved
  to data-residency / ZDR / cost / self-host — NOT a leaderboard delta. Picking closed "for
  quality" is a 2023 reflex.

---

## 3. The reranker taste — "the biggest lever, EXCEPT when it isn't"
Sources: medium.com/@bhagyarana80 *Top 8 Rerankers: Quality vs Cost* (2026); docs.bswen.com
*Best Reranker Models for RAG* (2026-02-25); zeroentropy.dev (vendor, flagged). Accessed 2026-06-17.

### TASTE 3a — reranking is usually the single biggest quality lever
> **"rerankers can jump nDCG@10 by 5–15 points"** for long-tail phrasing and multi-hop
> questions — transforming "meh RAG into useful." Cross-encoder reranking improves RAG accuracy
> by **20–35%** but adds **200–500ms latency per query** (≈100ms on GPU).
- The non-obvious edge: of all the levers (better embeddings, fusion tuning, reranking), the
  cross-encoder rerank of the top-100 usually gives the biggest single jump. If you can only do
  ONE thing to a hybrid pipeline, add a reranker.

### TASTE 3b — but KNOW when NOT to rerank (the discipline)
> **"You should NOT use a reranker if you have sub-100ms latency requirements OR when your
> retrieval corpus is small enough that bi-encoder MRR@5 already exceeds 0.85."**
- The non-obvious edge: beginners bolt a reranker onto everything. Experts skip it when (a)
  latency budget can't absorb 100–500ms, or (b) retrieval is already good enough (MRR@5 > 0.85) —
  reranking a near-perfect candidate set is pure latency cost for no gain.

### TASTE 3c — the model-choice taste (open beats API on latency+cost at quality parity)
> Concrete 2026 benchmark (medium.com/@bhagyarana80, 8 rerankers): quality nDCG@10 — MonoT5-3B
> (0.726) ≈ Cohere (0.735) ≈ bge-large-v2 (0.715); speed p95 — MiniLM 55ms, bge-base 92ms,
> Jina-v2 110ms; cost/1k — MiniLM $0.08, bge-base $0.18, bge-large $0.35. Recommendation:
> **"bge-reranker-large v2 if you can batch on GPU; otherwise bge-base"**; Cohere "for
> reliability, not performance — the managed infrastructure and SLAs matter more than latency."
- The non-obvious edge: practitioners pick Cohere for the SLA/managed-infra, NOT because it wins
  quality (it's within noise of open bge-large/MonoT5). On a GPU, open rerankers match API
  latency at zero marginal cost. (ZeroEntropy's "40× cheaper than Cohere, 100+ languages,
  calibrated scores" is real but it's a VENDOR claim — flagged.)

---

## 4. The cross-cutting meta-taste (the one-liners that encode seniority)
Distilled from all field + ecosystem files. These are the "if you only remember five things":
1. **"It's now entirely about how precisely you understand where each [retriever] fails."**
   (TianPan, field-01.) Seniority = naming the failure class, not knowing the tool.
2. **"Search is never done."** (HN canon + Turnbull's "project will fail" talk.) Relevance is a
   continuous process with a permanent eval loop, not a one-shot index.
3. **"Hybrid > vector, but RRF is the FLOOR not the finish"** (+7.5% tuned vs +1.3% naive RRF,
   field-01). Average ships RRF and stops; great tunes the fusion tiers.
4. **"MTEB is a prior, not an oracle"** (§2a). Leaderboards generate shortlists; your golden set
   decides.
5. **"The bottleneck is usually the org, not the engine"** (Turnbull §1a). Which is the strongest
   argument for an autonomous, soup-to-nuts search EMPLOYEE — exactly what truffle is.

---

## 5. Sources (this file)
- Doug Turnbull, *One big reason search teams fail* (2023-07-08) —
  https://softwaredoug.com/blog/2023/07/08/why-search-orgs-fail
- Doug Turnbull, *All search is structured now* (2025-04-02) —
  https://softwaredoug.com/blog/2025/04/02/all-search-structured-now
- Doug Turnbull, *Why Your Search Relevance Project Will Fail* (talk) —
  https://www.youtube.com/watch?v=Ms9QBBB8MxE ; *Relevant Search* (Manning) —
  https://www.manning.com/books/relevant-search
- HN, *What every software engineer should know about search*, id=15231302 —
  https://news.ycombinator.com/item?id=15231302
- *Which Embedding Model Should You Actually Use in 2026?* (Cheney Zhang, 2026-03-20) —
  https://zc277584121.github.io/rag/2026/03/20/embedding-models-benchmark-2026.html
- tensoria.fr, *8 Embedding Models Compared for Production RAG [2026]* —
  https://tensoria.fr/en/blog/embedding-models-2026-guide
- app.ailog.fr embedding guides (2025/2026) — https://app.ailog.fr/en/blog/news/embedding-models-2026
- medium.com/@bhagyarana80, *Top 8 Rerankers: Quality vs Cost* (2026) —
  https://medium.com/@bhagyarana80/top-8-rerankers-quality-vs-cost-4e9e63b73de8
- docs.bswen.com, *Best Reranker Models for RAG* (2026-02-25) — https://docs.bswen.com/blog/2026-02-25-best-reranker-models/
- zeroentropy.dev (VENDOR, flagged) — https://zeroentropy.dev/articles/llm-as-reranker-guide/
- All accessed 2026-06-17.
