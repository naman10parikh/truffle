#!/usr/bin/env bash
# scripts/acceptance-local.sh — run THE acceptance test locally + assert all 6 §5 verify steps (E6, the bar / G1).
#
# Mirrors the acceptance.yml CI job against a locally-booted Meili container + the COMMITTED fixture vectors.
# Boots the engine (or reuses a running one), indexes the fixture corpus (no embed API), runs THE acceptance query,
# and asserts: (1) indexed+searchable, (2) typo corrected, (3) lexical-ID exact + ranked, (4) faceted,
# (5) fusion_mode==hybrid, (6) `truffle eval --suite golden` green. Exit 0 only if ALL six pass.
#
# Usage:  bash scripts/acceptance-local.sh   (requires Docker for `engine up`, or a Meili already on MEILI_URL)
set -euo pipefail

export MEILI_URL="${MEILI_URL:-http://localhost:7700}"
export MEILI_MASTER_KEY="${MEILI_MASTER_KEY:-masterKey}"

# Resolve the truffle CLI (prefer the linked binary; fall back to dist).
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
if command -v truffle >/dev/null 2>&1; then TRUFFLE="truffle"; else TRUFFLE="node $ROOT/dist/cli/index.js"; fi

echo "== truffle acceptance (local) =="
echo "engine: $MEILI_URL"

echo "-- 0. engine up (boot or reuse) --"
$TRUFFLE engine up --engine meili

echo "-- 1. index (committed fixture vectors, no embed API) --"
INDEX_OUT="$($TRUFFLE index ./fixtures/corpus --engine meili --hybrid)"
echo "$INDEX_OUT"
echo "$INDEX_OUT" | grep -q "searchable=true" || { echo "FAIL (1): index did not report searchable=true"; exit 1; }

echo "-- 2-5. THE acceptance search --"
SEARCH_JSON="$($TRUFFLE search "kuburnetes RTX-4090 0x80070005" --hybrid --facet category --top 10 --json)"
echo "$SEARCH_JSON" | python3 - "$SEARCH_JSON" <<'PY'
import json, sys
data = json.loads(sys.argv[1])
hits = data["hits"]
ids = [h["id"] for h in hits]
# (2) typo-tolerant: the kubernetes doc (d01) is returned for the typo'd 'kuburnetes'
assert "d01" in ids, f"FAIL (2): typo 'kuburnetes' did not return the kubernetes doc d01; ids={ids}"
# (3) lexical-ID: the 0x80070005 doc (d04) is present AND RTX-4090 (d02) ranks above RTX-4070 (d03)
assert "d04" in ids, f"FAIL (3a): error-code doc d04 not in hits; ids={ids}"
assert ids.index("d02") < ids.index("d03"), f"FAIL (3b): d02 (RTX-4090) must rank above d03 (RTX-4070); ids={ids}"
# (4) faceted: a facets.category block with per-value counts
assert data.get("facets", {}).get("category"), f"FAIL (4): no facets.category block; got {data.get('facets')}"
# (5) hybrid
assert data["fusion_mode"] == "hybrid", f"FAIL (5): fusion_mode != hybrid ({data['fusion_mode']})"
print("  ✓ (2) typo corrected  ✓ (3) lexical-ID exact + ranked  ✓ (4) faceted  ✓ (5) fusion_mode==hybrid")
PY

echo "-- 6. eval --suite golden (Recall@10/MRR + 0 regressions) --"
$TRUFFLE eval --suite golden

echo "== ACCEPTANCE PASS ✅ — all 6 §5 verify steps green =="
