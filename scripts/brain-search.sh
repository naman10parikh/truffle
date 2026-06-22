#!/bin/bash
# brain-search.sh — Okapi BM25 search over brain/*.md (truffle's Memory queryable layer).
#
# Usage: ./scripts/brain-search.sh "query" [--limit N] [--json]
#
# This is the in-house-BM25 case truffle keeps on purpose (brain/OPINIONS.md O2, S16): the brain is a few
# hundred offline notes an agent greps — keep BM25, do NOT stand up a Meili server for it. truffle's *product*
# search uses real engines; this is the deliberate boundary demonstration.
#
# Engine: src/core/brain-index.ts (k1=1.5, b=0.75). Runs via Node type-stripping so it works pre-build;
# once `pnpm build` runs, the CLI verb `truffle brain search` calls the same compiled core.

set -euo pipefail

REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"
BRAIN_DIR="$REPO_DIR/brain"
CORE_TS="$REPO_DIR/src/core/brain-index.ts"
CORE_JS="$REPO_DIR/dist/core/brain-index.js"

QUERY=""
LIMIT=5
JSON=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --limit) LIMIT="$2"; shift 2 ;;
    --json) JSON=true; shift ;;
    --help|-h)
      echo "Usage: brain-search.sh \"query\" [--limit N] [--json]"
      echo "  BM25 search over brain/*.md (truffle's expertise brain)."
      exit 0
      ;;
    *) QUERY="$1"; shift ;;
  esac
done

if [ -z "$QUERY" ]; then
  echo "Error: no query provided" >&2
  echo "Usage: brain-search.sh \"query\" [--limit N] [--json]" >&2
  exit 1
fi

# Prefer the compiled core if it exists (post-build); fall back to type-stripping the .ts (pre-build).
if [ -f "$CORE_JS" ]; then
  ENTRY="$CORE_JS"
  NODE_FLAGS=""
else
  ENTRY="$CORE_TS"
  NODE_FLAGS="--experimental-strip-types"
fi

Q="$QUERY" L="$LIMIT" J="$JSON" node $NODE_FLAGS --input-type=module -e "
import { brainSearch } from '$ENTRY';
const hits = brainSearch(process.env.Q, '$BRAIN_DIR', Number(process.env.L));
if (process.env.J === 'true') {
  console.log(JSON.stringify(hits.map(h => ({ file: 'brain/' + h.file, score: Number(h.score.toFixed(4)), line: h.line, excerpt: h.excerpt })), null, 2));
} else {
  if (hits.length === 0) { console.log('No results for: ' + process.env.Q); process.exit(0); }
  hits.forEach((h, i) => {
    console.log('[' + (i + 1) + '] brain/' + h.file + ' (score ' + h.score.toFixed(3) + ', line ' + h.line + ')');
    if (h.excerpt) console.log('    ' + h.excerpt);
  });
}
" 2>/dev/null
