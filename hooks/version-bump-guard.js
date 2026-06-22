#!/usr/bin/env node
/**
 * version-bump-guard — truffle's search-aware lifecycle hook (CP123 B4).
 *
 * THE HOUSE RULE IT AUTOMATES: "never treat a search-engine version bump as a no-op."
 * The fast OSS engines (Typesense, Meilisearch, pgvector) move quickly and occasionally REGRESS core
 * behavior across minors — Typesense v28 SILENTLY broke typo tolerance (#2313, OPEN), v28 hybrid +
 * symbols_to_index broke scoring (#2365), Meili swapped arroy→hannoy + a delta-bitmap storage change that
 * does NOT auto-migrate. So whenever an edit touches a file that pins an engine version, this hook FIRES and
 * requires the version-bump regression suite (typo + hybrid-scoring + lexical-ID classes) be re-run before
 * shipping. Source: brain/OPINIONS.md O20 · brain/KNOWN-PITFALLS.md P14/P15 · brain/BATTLE-TESTED-SCENARIOS.md S8.
 *
 * WIRED in .claude/settings.json as a PostToolUse matcher on Edit|Write|MultiEdit:
 *   { "matcher": "Edit|Write|MultiEdit",
 *     "hooks": [{ "type": "command", "command": "node hooks/version-bump-guard.js" }] }
 *
 * DUAL MODE (so it's both a real hook AND directly testable):
 *   - Hook mode:  reads the PostToolUse event JSON on stdin → checks tool_input.file_path.
 *   - CLI/test mode: `node hooks/version-bump-guard.js <file> [<file> ...]` checks the given files.
 *
 * EXIT CODES: 0 = no engine pin touched (silent, let the edit through);
 *             non-zero = an engine version pin was touched → warning written, "re-run the version-bump suite".
 * It NEVER blocks destructively — it WARNS (the agent must re-run `truffle eval --suite version-bump`). The
 * inherited generic hooks stay; this ADDS the search-specific one (Karpathy surgical).
 *
 * ESM: the repo's package.json sets "type":"module", so this file uses import (not require) — the inherited
 * .claude/hooks/*.js predate package.json and use CommonJS; matching the repo's module system here is correct.
 */

import fs from "node:fs";

// Engine version-pin patterns. Each match means "an engine version is being declared here" → the
// version-bump regression suite must be re-run before shipping. Kept deliberately tight so the hook is a real
// selective matcher (a non-engine edit does NOT fire), not an always-on nag.
const PIN_PATTERNS = [
  // getmeili/meilisearch:v1.28  ·  getmeili/meilisearch:latest  ·  getmeili/meilisearch@v1.28
  /getmeili\/meilisearch[:@]v?[\d.]+/i,
  /meilisearch[:@]v[\d.]+/i,
  // typesense/typesense:28.0  ·  typesense/typesense:27.1
  /typesense\/typesense[:@]v?[\d.]+/i,
  // supabase/postgres:15.x  ·  pgvector 0.8 / pgvector v0.8.0  ·  pgvector >= 0.8
  /supabase\/postgres[:@]v?[\d.]+/i,
  /pgvector[\s:@>=v]+[\d.]+/i,
];

/** Return the first engine-pin string found in `text`, or null. */
function findPin(text) {
  for (const re of PIN_PATTERNS) {
    const m = re.exec(text);
    if (m) return m[0];
  }
  return null;
}

/** Read a file safely; missing/unreadable → "" (a deleted file can't carry a pin). */
function readFileSafe(p) {
  try {
    return fs.readFileSync(p, "utf8");
  } catch (err) {
    // Intentionally silent: a path that can't be read carries no pin to guard.
    return "";
  }
}

/** Collect the file path(s) to inspect, from argv (test mode) or the PostToolUse stdin JSON (hook mode). */
function collectTargets() {
  const argvFiles = process.argv.slice(2).filter(Boolean);
  if (argvFiles.length > 0) return argvFiles;

  // Hook mode: Claude Code pipes the tool event as JSON on stdin.
  let raw = "";
  try {
    raw = fs.readFileSync(0, "utf8");
  } catch {
    // Intentionally silent: no stdin (e.g. invoked with no args + no pipe) → nothing to check.
    return [];
  }
  if (!raw.trim()) return [];
  try {
    const evt = JSON.parse(raw);
    const ti = evt.tool_input || {};
    const paths = [];
    if (typeof ti.file_path === "string") paths.push(ti.file_path);
    // MultiEdit passes an edits array but the same file_path; Write/Edit pass file_path. Cover both shapes.
    if (Array.isArray(ti.files)) {
      for (const f of ti.files) if (f && typeof f.file_path === "string") paths.push(f.file_path);
    }
    return paths;
  } catch {
    // Intentionally silent: a malformed/unknown event shape is not our concern — let the edit through.
    return [];
  }
}

function main() {
  const targets = collectTargets();
  const flagged = [];
  for (const p of targets) {
    const pin = findPin(readFileSafe(p));
    if (pin) flagged.push({ file: p, pin });
  }

  if (flagged.length === 0) {
    process.exit(0); // No engine pin touched — silent.
  }

  // An engine version pin was touched. WARN (do not hard-block) and require the regression suite.
  const lines = [
    "⚠️  truffle version-bump-guard — an engine version pin changed:",
    ...flagged.map((f) => `      ${f.file}  →  ${f.pin}`),
    "",
    "    A search-engine version bump is NEVER a no-op (brain O20/P14/S8: Typesense v28 silently",
    "    broke typo tolerance #2313; Meili arroy→hannoy + delta-bitmap don't auto-migrate).",
    "    BEFORE shipping this, re-run the version-bump regression suite:",
    "",
    "        truffle eval --suite version-bump",
    "",
    "    It re-runs the typo + hybrid-scoring + lexical-ID golden classes. If a class regresses,",
    "    pin the prior working version and track the upstream issue — do NOT just raise the typo params.",
  ];
  process.stderr.write(lines.join("\n") + "\n");
  // Non-zero so the warning is unmissable (PostToolUse non-zero surfaces the message to the agent).
  process.exit(2);
}

main();
