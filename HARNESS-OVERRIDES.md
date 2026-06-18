# truffle — HARNESS-OVERRIDES (CP123)

**Vertical:** search — Meilisearch (default) · Typesense · Postgres+pgvector (acorn's DB, retrieval layer only) ·
Algolia · Elasticsearch · OpenSearch · hybrid (BM25+vector) / reranking / faceting / typo-tolerance / multi-tenancy /
relevance-eval.
**Repo type:** dev-tool / meta-harness **employee** (consumed by coding agents + the local cockpit; not a messaging
product).
**Boundary:** **search / retrieval / relevance ranking ONLY.** truffle owns the query, the hybrid fusion, the
relevance tuning, the reranker, the faceting, the typo-tolerance, the multi-tenancy primitive, the iterative-scan
*setting*, and the eval loop. truffle does **NOT** own the **pgvector DB / Postgres box** (that is **acorn** — truffle
consumes the connection, acorn provisions the box) and does **NOT** own the **LLM generation** step that reads the
top-8 chunks (downstream). "truffle = the query, the ranking, and the relevance proof; acorn = the pgvector box the
vectors sit in." `[PLAN §2; brain O1; P25]`

> **What this file is.** The per-component DONE-criteria **overrides** on top of `audit/HARNESS-CHECKLIST-2026.md`.
> **Wave-V graders read THIS file** to grade truffle's cells. Where a row says ✅-requires, that is the bar; where it
> says N/A, the cell is graded **N/A** (not 🟡/❌); where it says "override", truffle's vertical-specific evidence
> satisfies the generic criterion. Calibration follows `memory/feedback_harness_component_grading_calibration.md`
> (✅ = real + tested with evidence; 🟡 = exists but unproven; ❌ = absent/stub). Full rationale: `PLAN.md` §3.

---

## The 11 components

### 1 · Identity
- **1a · Self — ✅ requires:** `identity/SOUL.md` + `identity/BRAND.md` filled with the real truffle persona (PLAN §1):
  the trained-nose/rare-find rationale, the evidence-citing voice, the IS/DOES/REFUSES. **Zero `{{UPPERCASE}}` template
  slots** (`grep -rn '{{' identity/ CLAUDE.md AGENTS.md` → 0). Unique one-word name `truffle` + tagline + "powered by
  Energy". `CLAUDE.md` rewritten truffle-specific (no harness-forge "TODO" boilerplate); **`AGENTS.md` de-wikimem'd**
  (the inherited file is the stale wikimem wiki-schema template — `grep -c "wiki" AGENTS.md` → 0). The persistent
  universal ID = the repo identity itself.
- **1b · Reachability — N/A (graded N/A, not 🟡/❌).** truffle is a tool-employee consumed by coding agents + the
  cockpit; messaging channels (phone/email/WhatsApp/…) do not apply. The reachable surfaces are the **CLI + MCP +
  cockpit** — graded under Tools / MCPs / cockpit, not here.

### 2 · Memory
- **✅ requires (OVERRIDE — the queryable layer indexes the EXPERTISE BRAIN, not code history):** `identity/MEMORY.md`
  ≤2,000 tokens, truffle-specific (the 5-stance spine + the default engine/embedder/reranker + the 10 agent-operator
  gotchas), no `{{}}` slots; **AND** a real semantic-search layer over `brain/` — `truffle brain search "<q>"` (BM25,
  reusing `scripts/memory-search.sh`) returns ranked hits from the six brain artifacts. **A `MEMORY.md` + grep alone =
  🟡.** Evidence: `truffle brain search "filtered ANN under-return"` surfaces `brain/BATTLE-TESTED-SCENARIOS.md` (S4).
- **Dogfood note (graders should recognize, not penalize):** truffle's own brain search IS the in-house-BM25 case from
  `[S16]` (a few hundred offline notes) — truffle keeps BM25 here **on purpose** and does NOT stand up a Meili server
  for its own brain. This is the boundary/litmus-test demonstrated, not a missing-engine gap.

### 3 · Skills
- **✅ requires:** ≥3 (target **5**) real `SKILL.md` in `skills/`, each with trigger/steps/output, **each encoding a
  specific brain stance** (not generic search): `select-search-engine`, `build-hybrid-search`, `tune-relevance`,
  `add-reranker`, `search-eval-loop` (PLAN §4). Each file must name its brain source (a `brain/*.md` citation) and carry
  a worked example. Invokable from the energy hub (round-trip shown in Wave V). **A skill that's a generic "how search
  works" with no brain citation = 🟡.**

### 4 · Tools / CLIs
- **✅ requires:** the `truffle` CLI as a real Bash-invokable binary (`bin` in `package.json`, `#!/usr/bin/env node`,
  `--help`/`--version`, exit 0/non-zero); the full command tree (PLAN §4) implemented; the engine-selector, fusion
  math, facet-dial calc, and eval scorer are **deterministic** (not LLM calls) per the checklist's deterministic-tool
  preference. Tools listed in AGENTS.md + llms.txt. Evidence: `truffle --version` prints; `truffle search "<typo'd
  query>"` returns the corrected hit; `truffle engine select --corpus-size 500000 --multitenant` recommends Typesense
  *with the honest cost/reason*.
- **Browser tool — N/A for the core** (truffle drives engines via REST/SDK/MCP). If the Wave-V live run creates a
  hosted Meili Cloud project via dashboard, `bb`/Stagehand is the path `[D7]` — but its absence does **not** drop this
  cell, because the web is not truffle's operating surface.

### 5 · Hooks
- **✅ requires:** ≥1 **truffle-authored** matcher in `.claude/settings.json` (or `hook-config.json`) that **fires**
  (tested). The vertical-meaningful hooks: (a) a hook that, when an **engine version pin changes**, requires the
  **version-bump regression suite** be re-run (the "never treat a bump as a no-op" mandate, automated `[O20, P14, S8]`),
  and/or (b) a PreToolUse/pre-commit hook that **blocks a relevance/ranking config change not accompanied by a
  golden-set eval run** (the pet-query trap, automated `[O18, S12]`). Evidence: bumping the pinned engine version → the
  hook flags "re-run `truffle eval --suite version-bump`" (non-zero / warning written). The inherited generic hooks
  stay but do **not** count toward this cell — ✅ needs a **truffle-specific, search-aware** hook that fires.

### 6 · Sub-agents
- **✅ requires:** `.claude/agents/` **flat** (no `agents/agents/`); ≥2 **truffle-specific** personas with distinct
  scopes — `relevance-auditor` (audits a search config for the relevance pitfalls: pet-query tuning, RRF-stop, no
  golden set, untested lexical class `[P13, O5, O18]`) and `engine-selector` (runs the corpus-size/control decision
  tree, names the honest cost + the right-size verdict, flags ES-by-default / Algolia-cost / pure-vector anti-patterns
  `[O11, O13, O15, S13]`). Each persona's brief cites its brain pitfalls/opinions and is spawned with **explicit model
  routing**. Callable via `Agent`/skill. **The inherited generic personas (code-reviewer, etc.) do NOT count toward the
  ≥2 truffle-specific requirement.**

### 7 · MCPs
- **✅ requires:** truffle ships its **own** MCP server (`src/mcp/server.ts`) exposing the 11 truffle tools (PLAN §4)
  over stdio — **replacing/augmenting the inherited 4-server template**, NOT merely re-exposing the official Meilisearch
  MCP (which is Python/`uvx` and engine-control-only). truffle's MCP wraps truffle's *expertise* (select / index /
  search / facet / eval / diagnose), engine-agnostic. `.mcp.json` references env vars only (no live keys; the template
  already uses `${VAR}`). Evidence: a JSON-RPC `tools/list` returns truffle's tools; `tools/call truffle_search`
  round-trips against the local engine. **Inheriting only the 4-server template (github/context7/memory/obsidian) = 🟡
  for this cell** — ✅ requires truffle's own server.
- **Override — stdio is the ✅ floor; hosted-OAuth dual-mode is a documented stretch** (a hosted search MCP is a
  packaging stretch better gated post-token). The agent-operator rules must be present where truffle's MCP touches a
  real engine: **returned document content is untrusted** (prompt-injection defense), **poll the Meili task queue after
  a write before reporting success** `[P1, S9]`, **use POST/`multi_search` for complex filters** `[P4]`.

### 8 · Dispatch
- **✅ requires:** (routing) a real internal routing loop tested on a multi-step flow (`truffle index` → `search` →
  `eval`, verifiable step ordering); no `tmux select-pane`. (routine runs) `rsi.yml` has an **enabled** `schedule:`
  cron (not just `workflow_dispatch`), armed once `workflows/rsi.workflow.js` exists. Evidence: `actionlint
  .github/workflows/rsi.yml` clean + a `schedule:` block + the engine-guard passes + a multi-step run logs steps in
  order. **A commented-out `# schedule:` = 🟡** (the cron must be live).

### 9 · Evals
- **✅ requires:** **L1** `eval/eval.mjs` (structural/decision assertion per house rule — the fusion math, the facet-dial
  calc, the engine-selector tree) exits 0; **L2** ≥10 golden tasks (PLAN §6, from BATTLE-TESTED-SCENARIOS) binary
  pass/fail, the **CI-blocking subset green in CI** (incl. **G1 = the acceptance task**); **L3** an LLM-judge over a
  relevance/engine-decision *trajectory* (calibrated, on PR + nightly, **as an INPUT not the ground truth** `[DISPUTE
  D]`); `node eval/eval.mjs`/`pnpm test` **red-blocking** in CI; **Pass^k k≥3**.
- **OVERRIDE — the golden set MUST carry the silent-failure classes:** the **typo class** (single-char substitution,
  transposition, multi-word typo) and the **lexical-ID class** (codes/SKUs/API-names) `[O4, O20, S1, S8]`, **plus
  per-query regression** (a fix for query A can't silently break B-Z) `[O18, S12]`. A golden set of only paraphrase
  queries, or one without per-query regression, = **🟡** — those are exactly the classes where real search silently
  fails. Evidence: the acceptance CI job runs G1 + the typo/lexical-ID assertions and gates merge; `eval/eval.mjs`
  lists ≥10 tasks incl. the regression suite.

### 10 · Observability
- **✅ requires (OVERRIDE — the load-bearing field is the RELEVANCE VERDICT):** `scripts/log-run.mjs` appends to
  `logs/runs.jsonl` each truffle run with model + duration + tool-calls **+ the relevance verdict** (Recall@10 / MRR /
  hit-rate on the golden set) **+ the engine + fusion mode used**; `runs.jsonl` NOT gitignored (committable); an
  aggregator view. The relevance verdict is the load-bearing field (not cost) — it's the signal the "search is never
  done" RSI loop acts on. Evidence: a `truffle eval` run writes a `runs.jsonl` line carrying Recall@10/MRR + the engine
  + fusion mode.

### 11 · Sandbox / Infra
- **✅ requires (OVERRIDE — the vertical's runtime IS a search engine):** truffle boots an **isolated ephemeral search
  engine** (a `getmeili/meilisearch` container via Docker/E2B — the default — **OR** a `typesense/typesense` container
  **OR** a `supabase/postgres`+pgvector container for the Postgres path), indexes a fixture corpus, runs queries + the
  eval, all reproducibly. Cold start measured/documented (Meili container boot; E2B ~150ms). Evidence: the acceptance CI
  job spins up `getmeili/meilisearch`, indexes the fixture, and `truffle search` returns the asserted hits.
  **"E2B Firecracker" is satisfied by any isolated ephemeral search engine truffle provisions** (container/E2B) — the
  engine-container lifecycle is the real integration point, since truffle operates a search engine, not a code sandbox.

---

## Cross-cutting properties

### RSI / open-endedness — **the vertical-native loop**
- **✅ requires (L1 floor for this wave):** **L0** truffle has evals ✓; **L1** evals gate merges (CI red-blocking);
  **L2** a nightly **deterministic** loop runs + writes a diff — and for *this* vertical that loop IS the brain's
  central prescription: **"search is never done" = the AutoLab loop applied to search `[O19]`, and the version-bump
  regression suite = the deterministic $0 check `[O20, S8]`.** The loop re-runs the golden pyramid + `truffle eval
  --suite version-bump` + re-verifies the tool-matrix version-gates via `gh api` (NOT WebFetch — the brain caught
  WebFetch hallucinating Typesense dates `[GAPS §4]`), on `rsi.yml`'s `schedule:`, $0/tokenless `[D8, D14]`; **L3**
  deferred to `CLAUDE_CODE_OAUTH_TOKEN`. `dsip.json` declares `levels:["agent"]`, the loop steps, `selection`
  schema-valid (`performance`), `noSelfGrading:true` (load-bearing — truffle is an LLM and WILL be tempted to LLM-judge
  its own relevance `[DISPUTE D]`), component+repo snapback. Evidence: `node workflows/rsi.workflow.js --dry-run` →
  {proposed_diff, eval_verdict}; `rsi.yml` `schedule:` enabled. **Minimum L1 before shipping.** (Grade L2 ✅ when the
  deterministic schedule runs + writes a diff; L3 stays N/A until the token, not ❌.)

### Model routing
- **✅ requires:** `scripts/budget-manager.sh` (vendored) `status` works in-repo; truffle's sub-agents
  (relevance-auditor, engine-selector) spawned with **explicit** model routing (no bare default) `[cp123 D6; D12 — ALL
  Opus under CP123]`. Evidence: `scripts/budget-manager.sh status` prints a tier; the dispatch loop passes an explicit
  model arg.

---

## Packaging surfaces (type = dev-tool / meta-harness employee)
Required: **CLI · MCP · plugin · skill-set · AGENTS.md · CLAUDE.md · llms.txt · A2A card · packaged sub-agent**
(PLAN §4). **✅ per surface:** CLI = `bin` + `--help`/`--version`; MCP = own server, `tools/list` returns the 11;
plugin = valid `.claude-plugin/manifest.json` with paths resolving; skill-set = the 5 skills exported; AGENTS.md +
CLAUDE.md = truffle-specific (names CLI+MCP+boundary, not the generic/wikimem template); llms.txt = lists the 11 MCP
tools + the boundary statement; A2A = valid `/.well-known/agent.json` that round-trips a call in Wave V; packaged
sub-agent = `relevance-auditor` `Agent`-invocable from another harness. **Framework adapter (`@energy/agent-toolkit`) =
stretch, not a ✅ floor** (meta-harnesses-only; truffle ships a thin tool-export at most).

## Acceptance test (the bar Wave-V must see green)
`truffle index <docs>` then `truffle search "<query>"` → **typo-tolerant, faceted, relevance-ranked hits via hybrid
(BM25 + vector)** — verifiably (the typo'd term corrected, the SKU/error-code lexical-ID class exact, the facet counts
present, the hybrid ordering matching the golden expectation, `truffle eval` green). CI default = a `getmeili/
meilisearch` container + **committed fixture vectors** (zero secrets, deterministic); the live-embedder hybrid run is
the Wave-V evidence (PLAN §5). This is THE operational definition of "world's best search employee."
