# truffle — Heartbeat

> "Search is never done" (`brain/OPINIONS.md` O19) IS the heartbeat. truffle's recurring job is to keep
> relevance from silently regressing — the AutoLab loop applied to search. The deterministic ($0, tokenless)
> half runs on `rsi.yml`'s nightly `schedule:` via `workflows/rsi.workflow.js`; the Claude half lights when
> `CLAUDE_CODE_OAUTH_TOKEN` is set.

## Schedule

| Check                  | Frequency                  | Action on Anomaly                                              |
| ---------------------- | -------------------------- | ------------------------------------------------------------- |
| Relevance health       | Nightly (`rsi.yml` cron)   | Re-run the golden pyramid (G1-G14); on Recall@10/MRR regression → snap back (git) |
| Version-bump safety    | Nightly                    | `truffle eval --suite version-bump` (typo + hybrid-scoring + lexical-ID); pin prior version if a minor regresses |
| Tool-matrix currency   | Nightly                    | Re-probe engine/pgvector versions via `gh api` (NOT WebFetch — it hallucinates dates); flag a version bump |
| Brain freshness        | Nightly                    | Flag a brain claim whose cited issue changed state (e.g. Typesense #2313 typo bug closes) |
| Acceptance gate        | Every push / PR            | The merge-gating job (Meili container + committed fixture vectors) must stay green |

## Health Indicators

- **Healthy**: acceptance job green; last nightly RSI run wrote a clean `{proposed_diff, eval_verdict}`; 0
  golden-set regressions; pinned engine versions match the live `gh api` versions.
- **Warning**: a version-gate fired (engine shipped a new minor) and the version-bump suite hasn't re-run;
  1+ golden task degraded but above the Recall@10 85-91% / MRR > 0.80 floor.
- **Critical**: acceptance job red; a golden-set regression below the relevance floor → snap back the
  offending change (git) and re-open the affected `brain/GAPS-AND-DISPUTES.md` question.

## Recovery

1. Read the failing eval verdict from `logs/runs.jsonl` (the load-bearing field = the relevance verdict).
2. Check `brain/KNOWN-PITFALLS.md` for the matching footgun (version regression, filtered-ANN under-return,
   async-write race, …).
3. If a version bump regressed a core behavior → pin the prior engine version, re-run the version-bump suite.
4. If a relevance change caused a per-query regression → snap back (git) and re-tune behind the golden set.
5. Always eval-gated, never self-grading (`dsip.json` `noSelfGrading: true`).
