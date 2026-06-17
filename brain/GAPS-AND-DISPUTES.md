---
title: "truffle GAPS-AND-DISPUTES — where sources disagree, where none exists, what's unconfirmed"
type: synthesis
domain: search
created: 2026-06-17
updated: 2026-06-17
tags: [gaps, disputes, unverified, anti-bluff, mteb, rrf, llm-as-judge, postgres-vs-engine, truffle, cp123]
sources: ["brain/research/raw/ecosystem-08-gaps-and-disputes.md", "brain/research/raw/ecosystem-00-versions-and-changelogs.md", "brain/research/raw/ecosystem-06-tradeoff-matrix.md", "brain/research/raw/ecosystem-09-es-opensearch-minor-deltas.md", "brain/research/raw/field-01-hybrid-beats-vector-and-relevance-hell.md", "brain/research/raw/field-02-faceting-at-scale-and-migration-war-stories.md", "brain/research/raw/field-04-explicit-taste-from-great-practitioners.md", "brain/research/raw/field-05-version-gotchas-disputes-and-2026-shifts.md"]
related: ["[[truffle EXPERTISE-MAP]]", "[[truffle OPINIONS]]", "[[truffle KNOWN-PITFALLS]]", "[[truffle TOOL-MATRIX]]"]
summary: "Honest ledger of what truffle could NOT confirm, the genuine disputes (with both sides + truffle's resolved-for-now stance), the topics where the answer is genuinely 'it depends / measure it' (truffle must form its own view via experiments), plus a methodology note on a hallucinated source caught and corrected. Unlike sibling stamp, truffle has BOTH research halves (ecosystem + field) — the meta-gap is small."
---

# truffle GAPS-AND-DISPUTES

> Stating these is the anti-slop floor — flag the unknown, don't fabricate. A future truffle session should
> close the gaps before relying on the affected claim, and re-open the disputes if new evidence lands. Where a
> topic has no single right answer, truffle must form its own view via **experiments** (run the engine on YOUR
> corpus, measure on a golden set) — that's flagged "FORM-OWN-VIEW / MEASURE."

---

## 0. THE META-NOTE (read first — and it's GOOD news)

**Unlike sibling employee stamp, truffle's research is complete on BOTH halves.** The Wave-R brief expected
ecosystem AND field research; truffle has the full **ecosystem set** (`ecosystem-00`–`09`: versions, starters,
docs flows, GitHub-issue breakage, embeddings/rerank, agent-operator CLIs/MCPs, trade-off matrix, in-house BM25
comparison, gaps, ES/OpenSearch minor deltas) AND the full **field set** (`field-01`–`05`:
hybrid-beats-vector + relevance-tuning-hell, faceting-at-scale + migration war stories, ES ops nightmares,
explicit practitioner taste, version gotchas + disputes + 2026-shifts). So this brain is grounded in BOTH
ecosystem breadth AND first-person field depth (Vinted's 600M-item faceting postmortem, the de Jonge
20MB-crashes-14GB story, Doug Turnbull's relevance-engineering taste, dated Typesense/Meili regression issues).

- **What this means:** the scenarios in [[truffle BATTLE-TESTED-SCENARIOS]] are backed by named-company
  postmortems + tag-pinned GitHub issues, not just spec recitation. The remaining gaps below are narrow and
  mostly "measure it on your corpus," not structural.
- **The one residual depth gap:** there is no X/Twitter practitioner-signal layer — that source was ATTEMPTED
  but BLOCKED (§5). HN/Reddit/GitHub/engineering-blogs covered the practitioner axis instead.

---

## 1. Could NOT confirm (carried from `ecosystem-08`, re-verified as still open)

1. **OpenSearch 3.6/3.7 GRANULAR feature deltas** — release DATES are gh-api-verified (3.6.0 = 2026-04-07,
   3.7.0 = 2026-06-09) but the 3.6/3.7 release-notes markdown didn't resolve this pass (the build-repo path
   returned only ≤3.5.0). The 3.0→3.5 trajectory (in `ecosystem-09`) is the load-bearing one; 3.6/3.7 are
   recent minors on top. **Close via:** `gh api repos/opensearch-project/opensearch-build/contents/release-notes/
   opensearch-release-notes-3.7.0.md` or crawl opensearch.org/releases. Source: `ecosystem-08` §1.7.
2. **pgvector exact "latest stable" + 0.8.1/0.8.2 sub-release notes** — tags confirmed up to v0.8.2 via
   `gh api tags`, and the 0.8.0 iterative-scan fix is solid; but they tag, don't GitHub-release (releases API
   empty), so which 0.8.x is "latest stable" vs pre-release isn't pinned and the 0.8.1/0.8.2 notes weren't
   read. **Close via:** read pgvector `CHANGELOG.md`. Source: `ecosystem-08` §1.2.
3. **Algolia's exact 2025-26 feature timeline + current pricing tiers** — closed + SaaS, no semver. The MCP
   launch (2025-06-16), NeuralSearch, and the two hosted MCPs are confirmed from official pages, but the
   pricing numbers (1M searches ≈ $500-1,500; 10M ≈ $3,000-8,000) come from a vendor-adjacent comparison blog,
   NOT Algolia's pricing page (gated behind sales). **Treat pricing as DIRECTIONAL.** Close via: a real Algolia
   quote. Source: `ecosystem-08` §1.3.
4. **Meilisearch's own Q3-2026 embedder** — announced on the roadmap page (accessed 2026-06-17) but NOT shipped
   as of v1.47. It's a stated plan, not a verified release. Don't assume it exists yet. Source: `ecosystem-08`
   §1.4.
5. **Self-host vs managed break-even numbers** — the ~10-15M embeddings/month self-host break-even and the
   Algolia-cost-at-scale ranges are from blog sources; the real number depends heavily on YOUR query volume +
   infra. Directional, not gospel. **Close via:** model it for the specific deployment. Source: `ecosystem-08`
   §3.
6. **The Algolia→Typesense migration HN/Reddit exact quotes** — the "swapped an Algolia integration in a
   weekend" + "most common migration story is Algolia→Typesense once record counts cross low seven figures"
   lines came via search-engine synthesis, NOT a direct comment-permalink fetch. The PATTERN (people migrate at
   ~1M+ records over price) is well-attested; the EXACT wording is second-hand. **Close via:** authenticated
   browser on the specific HN/Reddit threads. Source: `field-02` §3.
7. **Meilisearch official MCP/CLI feature completeness** — `meilisearch/meilisearch-mcp` (192★) and
   `meilisearch/meilisearch-cli` are confirmed to EXIST under the official org via `gh api`, but their feature
   completeness wasn't audited. **Close via:** read the MCP tool list + CLI command surface before relying on a
   specific capability. Source: `ecosystem-08` §1.6.

---

## 2. Topics where the answer is "MEASURE IT" — truffle must FORM-OWN-VIEW via experiments

These are genuinely not settle-able from research — the right answer is corpus-specific. For these, truffle
should not bluff; it should run the experiment (index YOUR data, eval on a golden set) and write the result
back to `brain/`.

8. **The right embedding model for THIS corpus — FORM-OWN-VIEW / MEASURE.** MTEB is a prior, not an oracle
   (the MTEB-#11 model beat the top-3 on a legal corpus). The *shape* of the decision is clear (shortlist via
   MTEB → eval the shortlist → fine-tune last), but the WINNER is corpus-specific. **Experiment:** build a
   200-query domain golden set, run the shortlist (3-small, Jina v3, voyage-3-large, BGE-large), pick by
   recall@10/MRR on YOUR data. **Open work.** Source: `field-04` §2a; `ecosystem-04` §1.
9. **RRF-vs-tuned-tiered-fusion for THIS surface — FORM-OWN-VIEW / MEASURE.** The +7.5%-tuned-vs-+1.3%-naive
   gap is real on WANDS, but whether the tuning ROI is worth it depends on whether YOUR relevance is
   revenue-critical. **Experiment:** measure RRF on your golden set; if below Recall@10 85-91% / MRR > 0.80,
   tune the tiers and re-measure. **Open work.** Source: `field-01` §2; (Dispute B below).
10. **The exact engine for THIS deployment — FORM-OWN-VIEW.** "Meili vs Typesense vs Postgres" depends on
    whether you weight agent-tooling (Meili) vs latency+multitenancy (Typesense) vs no-new-infra (Postgres).
    **Experiment:** answer the corpus-size/control question, prototype the top-2 on your data, benchmark
    latency + facet-at-scale + the agent-control surface. **Open work.** Source: `ecosystem-08` §3;
    `field-01` §4.
11. **The version-bump regression suite for THIS index — FORM-OWN-VIEW / BUILD.** The *need* is proven
    (Typesense v28 typo regression #2313; Meili internals churn) but the concrete golden-query set is
    corpus-specific. **Experiment/build:** assemble the golden tests — typo cases (single-char substitution,
    transposition, multi-word typo), hybrid-scoring cases, the lexical class (codes/SKUs/API-names), facet
    correctness — and wire them as the version-bump gate (the "search is never done" loop = AutoLab applied to
    search). **Open work.** Source: `field-05` §1; `field-01` §3.

---

## 3. Genuine disputes (where smart people honestly disagree — both sides + truffle's resolved-for-now stance)

### DISPUTE A — Is Elasticsearch still the right bet in 2026?
- **YES (Pureinsights, 2026):** "For most enterprise use cases, yes — but the reasons why matter more than the
  answer." Strongest pro-ES claim: "Elasticsearch gives you more control over relevance than almost anything
  else on the market." Concedes it falls short at extreme vector scale + lacks native personalization, and
  "Elastic Cloud at scale is not cheap." Source: `field-01` §4 (Dispute A).
- **NO/mostly-no (the Meili/Typesense camp, vendor-adjacent):** "Elasticsearch is operationally heavy — don't
  use it for simple search when Meilisearch delivers better UX in 30 minutes"; ">40% of developers choose
  Typesense for ease of setup over Elasticsearch." Source: `field-01` §4; `field-03` §4.
- **truffle's resolved-for-now stance ([[truffle OPINIONS]] O11/O13):** both are right because they answer
  different questions. ES for "enterprise needs max relevance CONTROL + analytics + scale"; not-ES for "a
  product needs a good search box fast." The dispute is real ONLY if you conflate "search platform" with
  "search box." Answer the corpus-size/control question first. (Weight the Meili camp's FRAMING over their
  numbers — they sell the alternative.) Source: `field-01` §4.

### DISPUTE B — Is RRF good enough, or do you need tuned tiered boosting?
- **RRF-is-enough camp:** RRF is parameter-light, robust, "immediately outperforms both BM25 and pure KNN"
  (+1.3% on WANDS) — ship it and move on (common in RAG tutorials). Source: `field-01` §4 (Dispute B).
- **RRF-is-a-floor camp:** "naive RRF significantly undersells what properly tuned hybrid can achieve" — tuned
  tiered got +7.5% vs RRF's +1.3% (TianPan/ES-Labs WANDS). Source: `field-01` §2/§4.
- **truffle's resolved-for-now stance ([[truffle OPINIONS]] O5):** RRF is the FLOOR; tune the tiers IF
  relevance is revenue-critical, gated on a golden set. RRF + a reranker is fine for "good enough RAG
  grounding." The honest answer depends on whether relevance is revenue-critical — genuinely unresolved as a
  blanket rule. Source: `field-01` §4.

### DISPUTE C — "Just use Postgres" vs a dedicated engine; and Typesense vs Meilisearch as the default
- **"Just use Postgres":** ParadeDB `pg_search` (v0.24, Jun 2026) + pgvector is now credible for BM25+vector +
  faceting at small-mid scale — "one fewer service," driven by SQL. Source: `ecosystem-08` §3; `field-02` §5.
- **"Use a dedicated engine":** pg_search is younger (ORM gaps #1100, weak non-latin #3782, JOIN perf
  maturing), you hand-roll fusion, and row-stores are structurally worse at faceting — engine-grade
  faceting/typo/relevance UX still favors Meili/Typesense/ES. Source: `ecosystem-06` §2; `field-02` §2.
- **Typesense vs Meili as truffle's default:** Meili wins DX + official MCP/CLI + hybrid-default-on; Typesense
  wins raw latency + multitenancy (scoped keys) + cleaner hybrid API. Source: `ecosystem-08` §3.
- **truffle's resolved-for-now stance ([[truffle OPINIONS]] O12):** default Meilisearch (turnkey +
  agent-native); Typesense when latency/multitenancy dominate; Postgres (acorn's pgvector) when the app already
  runs Postgres and you want no new infra. Close, and corpus-dependent — "depends on corpus size, existing
  infra, and whether you need engine-grade faceting/typo UX." Source: `ecosystem-08` §3.

### DISPUTE D — Is LLM-as-judge a shortcut for search relevance eval, or a trap? (HOT in 2025-26)
- **The HYPE side:** use an LLM to score query→doc relevance at scale, skip expensive human labeling — "LLM
  judges let you eval relevance cheaply" (common in 2025-26 RAG/eval tooling; OpenSearch 3.5 even ships
  "LLM-as-judge" in its Search Relevance Workbench). Source: `field-05` §3 (Dispute D); `ecosystem-09` §2.
- **Doug Turnbull's NO (2025-11-02, *LLM Judges aren't the shortcut you think*):** "LLM judges aren't the
  shortcut teams hope. Instead, they are themselves a thing that needs data and monitoring." They "excel at
  topical relevance but miss what actually engages users — the 'lizard brain' factors driving real
  conversions." Prescription: use LLMs for FEATURE GENERATION, not final judgment; "comprehensive human
  labeling isn't eliminated by LLM judges — it becomes even MORE essential." Source: `field-05` §3.
- **truffle's resolved-for-now stance:** LOAD-BEARING for an agent-native search employee (it's an LLM — it
  will be TEMPTED to LLM-judge its own relevance). Lean Turnbull's way: **LLM-judge is an INPUT, not the eval
  ground truth** — keep a human-labeled (or behavior/engagement-derived) golden set as the real gate. Flag as
  genuinely contested. Source: `field-05` §3.

### DISPUTE E — Is search even a separate discipline, or just LLM query-understanding now?
- **Turnbull (2025, "all search is structured now"):** the future is LLM query-understanding + structured
  retrieval; engine-knob-tuning is fading; cheap local LLMs flipped query understanding to a default pre-step.
  Source: `field-04` §1b; `field-05` §3.
- **The hybrid/relevance traditionalists (TianPan/Pureinsights/WANDS-tuning camp):** the durable skill is
  still fusion + reranking + per-query relevance tuning on YOUR corpus; LLMs help the QUERY side but the
  retrieval/ranking craft is unchanged. Source: `field-05` §3.
- **truffle's resolved-for-now stance:** not actually opposed — LLMs reshape the QUERY-understanding front-end
  (truffle is natively that layer), the retrieval/fusion/rerank/eval BACK-END craft persists. Real tension only
  about where the VALUE concentrates. truffle does BOTH (LLM query-understanding → hybrid → rerank → eval).
  Flagged. Source: `field-05` §3.

---

## 4. Methodology note — a hallucinated source caught and corrected (the anti-bluff receipt)

- **WebFetch's page-summarizer HALLUCINATED Typesense release dates** — it claimed v30 = Jan 2025 and v28 =
  Feb 2024, both off by ~1 year. Caught by cross-checking `gh api releases` (v30.0 = 2026-01-27, v28.0 =
  2025-02-18). **LESSON (carry forward):** never trust a WebFetch date-summary for version history; confirm via
  `gh api`. ALL version dates in this brain are gh-api-verified. Source: `ecosystem-08` §2; `ecosystem-00`
  method note.
- **Vendor-bench cherry-picking flagged throughout:** Voyage's "+14% vs OpenAI" (on Voyage's own RTEB; the
  neutral MTEB gap is ~2.5pt), ZeroEntropy's "+18% vs Cohere" (own finance bench), comparison-blog "scores"
  (Typesense 95% speed etc. — directional). The NEUTRAL cites (Databricks +48%, MIT +40% for the cross-encoder
  PATTERN; the MTEB table itself) are trusted; head-to-head vendor numbers are not. Source: `ecosystem-08` §2.
- **ParadeDB faceting numbers are ParadeDB-vs-vanilla-Postgres, NOT ParadeDB-vs-Elasticsearch** — the
  DIRECTION (row stores struggle at faceting; columnar/inverted-index wins) is solid; the exact % is
  vendor-flavored. Source: `field-02` §2.

---

## 5. X / Twitter signal — STATUS: ATTEMPTED, BLOCKED (transparent)

The sanctioned in-house X path (`energy/scripts/x-content-intel/scrape.py` + `~/.claude/x-auth/x-session.json`)
was tried: **auth loaded successfully**, but the **targeted SEARCH endpoint returned HTTP 404** because the
script's hardcoded `SEARCH_DOC_ID` is a STALE GraphQL persisted-query hash (X rotates these every few weeks).
The home timeline worked (35 tweets) but it's the chairman's personal For-You feed — 0 genuine search-infra
practitioner content. **CONCLUSION:** X-targeted practitioner signal is UNAVAILABLE this session; the brain
relied on HN/Reddit/GitHub/engineering-blogs (well-attested). **FOLLOW-UP:** refresh `SEARCH_DOC_ID` in
scrape.py from a live X session, then re-run `python3 scrape.py --search "Elasticsearch Typesense Meilisearch
relevance"`. Source: `field-05` §5.

---

## 6. What a future session should close FIRST (priority order)

1. **Build the corpus-specific golden-query eval set + version-bump regression suite** (§2.11) — the biggest
   functional gap; everything in "search is never done" depends on it. This is the AutoLab loop applied to
   search.
2. **Measure the embedding model + RRF-vs-tuned-fusion on the actual deployment corpus** (§2.8, §2.9) — turn
   the "it depends" disputes into measured decisions for THIS product.
3. **Pin OpenSearch 3.6/3.7 granular deltas + pgvector 0.8.x latest-stable** (§1.1, §1.2) — recent-minor detail
   the version table defers.
4. **Refresh the X `SEARCH_DOC_ID` and pull live practitioner signal** (§5) — the one missing research axis.
5. **Resolve the LLM-as-judge stance with a real eval** (DISPUTE D) — load-bearing for an agent-native search
   employee that will be tempted to judge its own relevance; keep a human/behavior golden set as ground truth.
