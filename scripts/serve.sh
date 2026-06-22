#!/usr/bin/env bash
# scripts/serve.sh — launch the truffle cockpit (CP123 Cluster G / PLAN §10).
# Local-first, zero-dependency Node `http` server + a vanilla-JS SPA. Read-mostly, for the chairman's eyes [D3].
#
# Usage:   bash scripts/serve.sh            →  http://localhost:7787
#          TRUFFLE_WEB_PORT=8080 bash scripts/serve.sh
#
# The 4 views (all on REAL repo data):
#   1. Brain browser    — brain/*.md + MOC with wikilink nav + a `truffle brain search` box (BM25, no engine)
#   2. Run log          — tails logs/runs.jsonl (model · duration · relevance verdict · engine+fusion)
#   3. Eval scores      — the golden-task grid + acceptance badge + version-bump-suite status
#   4. Ask the employee — runs brain-search / engine-select / search against the fixture corpus
#
# The brain + engine-select paths are pure deterministic code (always work). The `search` path needs a booted
# engine — `truffle engine up --engine meili` first, or the view degrades gracefully with a clear boot hint.
set -euo pipefail

cd "$(dirname "$0")/.."

# Build the brain index (dist/core/brain-index.js) if it isn't there — the cockpit imports the compiled form.
if [ ! -f dist/core/brain-index.js ]; then
  echo "[serve] dist/ not built — running pnpm build first…"
  pnpm build
fi

exec node web/server.mjs
