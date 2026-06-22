---
name: search-eval-loop
description: Set up the search eval + version-bump regression loop that proves search works and keeps it from silently regressing. Use when the user says "set up a search eval", "prove search works", "we upgraded the search engine", or "version bump regression". Encodes "search is never done" as the AutoLab loop applied to search — the golden-query set + the version-bump regression suite (typo + hybrid-scoring + lexical-ID classes), never treat a bump as a no-op.
brain_source: brain/EXPERTISE-MAP.md JTBD-8 · brain/OPINIONS.md O8/O19/O20 · brain/BATTLE-TESTED-SCENARIOS.md S8/S11 · brain/KNOWN-PITFALLS.md P14/P15
---

# search-eval-loop

> Encodes JTBD-8 (survive version bumps) fused with JTBD-5's "search is never done" `[O19]`. **This is the RSI
> loop made a skill** — the eval pyramid + the version-bump regression suite ARE Energy's AutoLab/observer
> pattern applied to search. The fast OSS engines (Typesense, Meili) move quickly and occasionally REGRESS core
> behavior; never treat a bump as a no-op `[O20]`.

## Trigger

Fire when the request is: "set up a search eval", "prove search works", "we upgraded Meili/Typesense/pgvector",
"version bump regression", "did the engine upgrade break anything", or before relying on any new engine version.
Also fire whenever a relevance/engine change is about to ship without an eval gate — the eval IS the gate.

## Steps

1. **Build the golden set with the silent-failure classes `[O4, O20, S1, S8; OVERRIDE]`.** A golden set of
   only paraphrase queries is insufficient (it hides exactly where real search fails). It MUST carry:
   - the **typo class** — single-char substitution (`kuburnetes`→`kubernetes`), transposition, multi-word typo;
   - the **lexical-ID class** — codes/SKUs/API-names (`0x80070005`, `RTX-4090` vs `RTX-4070`);
   - the **paraphrase class** — where hybrid must beat BM25-alone;
   - **per-query regression** — a fix for query A must not silently break B–Z `[O18, S12]`.

2. **Wire the eval pyramid `[brain/BATTLE-TESTED-SCENARIOS coverage map]`:** **L1** structural/decision
   assertions (the fusion math, the facet-dial calc, the engine-selector tree — pure code, $0); **L2** ≥10
   behavioral golden tasks (binary pass/fail, Recall@10 85-91% / MRR > 0.80 targets); **L3** an LLM-judge over
   a relevance/engine-decision *trajectory* — used as an **INPUT, not the ground truth** (a human/behavior
   golden set remains the gate) `[GAPS DISPUTE D; dsip noSelfGrading]`. Run with `truffle eval --suite golden`.

3. **Never pick the embedder/reranker by MTEB rank — eval on YOUR golden set `[O8, S11]`.** MTEB is a PRIOR,
   not an oracle (the MTEB top-3 ranked 5th/7th/2nd on a real legal corpus; an MTEB-#11 model won). Use the
   leaderboard to SHORTLIST, then your golden set decides. Treat fine-tuning as the LAST lever after
   fusion+rerank.

4. **Run the version-bump regression suite after ANY engine upgrade `[O20, P14, P15, S8]`.** `truffle eval
   --suite version-bump` re-runs the typo + hybrid-scoring + lexical-ID classes BEFORE shipping a bump. Real
   incidents this catches: Typesense v28 SILENTLY broke typo tolerance (#2313, raising the typo params didn't
   help) `[P14]`; v28 hybrid+`symbols_to_index` broke scoring (#2365); Meili swapped its ANN backend
   arroy→hannoy and a delta-bitmap storage change that does NOT auto-migrate `[P15]`. If a minor regresses a
   core behavior: **pin the prior version** and track the issue. Re-verify engine version-gates via `gh api`
   against live changelogs (NOT WebFetch summaries — they've hallucinated Typesense dates).

5. **Snap back on regression.** If the eval verdict shows a relevance drop, the change does not ship — revert
   (git snap-back at component/repo granularity) and flag the regression. The loop runs deterministically ($0,
   tokenless) on the nightly `schedule:`; the Claude half (refresh a brain artifact, propose a new lint) lights
   up only when `CLAUDE_CODE_OAUTH_TOKEN` is set `[D8]`.

## Output format

```
GOLDEN SET:    typo class ✓ · lexical-ID class ✓ · paraphrase class ✓ · per-query regression ✓  (paraphrase-only = insufficient)
PYRAMID:       L1 structural ($0) · L2 ≥10 golden tasks (Recall@10/MRR) · L3 trajectory judge (INPUT, not gate)
VERDICT:       Recall@10 <x> · MRR <y> · hit-rate <z> · regressions: <0 | list>
VERSION-BUMP:  truffle eval --suite version-bump → <pass | FLAGGED: which class regressed + the issue #>
ACTION:        <ship | pin prior version + track issue | revert (snap-back) + refresh brain>
```

## Worked example

> **Request:** "We just bumped Typesense to v28. Tests pass and the build is green — ship it?"

1. "Tests pass + build green" ≠ search works `[O20]`. A search-engine bump is NOT a no-op.
2. `truffle eval --suite version-bump` re-runs the typo + hybrid-scoring + lexical-ID classes against the
   bumped engine.
3. v28 is the exact version that silently broke typo tolerance (#2313 OPEN) `[P14, S8]` — the typo class
   FLAGS the regression, and bumping `num_typos` won't fix it.

```
GOLDEN SET:    typo class ✓ · lexical-ID class ✓ · paraphrase class ✓ · per-query regression ✓
PYRAMID:       L1 ✓ · L2 12 golden tasks · L3 trajectory judge (nightly, INPUT only)
VERDICT:       Recall@10 0.71 (was 0.88) — typo-class queries dropped to ~0 matches
VERSION-BUMP:  truffle eval --suite version-bump → FLAGGED: typo class regressed (attributable to v28, NOT config — #2313 OPEN)
ACTION:        DO NOT SHIP — pin Typesense to the prior working minor + track #2313; re-check whether v28+ fixed it before adopting
```

The lesson the loop encodes: this is why the version-bump regression suite is built into the harness, not
optional — "search is never done" `[O19]`.
