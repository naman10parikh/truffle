// brain.ts — the `truffle brain search "<q>"` CLI verb (Memory queryable layer).
//
// Wires the BM25 brain index (src/core/brain-index.ts) into the truffle command tree. B2's CLI shell
// (src/cli/index.ts) registers this via `registerBrainCommand(program)`. Until then, the same index is
// runnable standalone via `scripts/brain-search.sh "<q>"`.
//
// This is the in-house-BM25 case truffle keeps on purpose (brain/OPINIONS.md O2, S16): the brain is a few
// hundred offline notes — keep BM25, don't stand up a Meili server for it.

import type { Command } from "commander";
import { brainSearch, defaultBrainDir, type BrainHit } from "../../core/brain-index.js";

/** Format hits for human-readable terminal output (file path is repo-relative, BATTLE-TESTED-SCENARIOS etc.). */
export function formatHits(hits: BrainHit[], query: string): string {
  if (hits.length === 0) return `No results for: ${query}`;
  return hits
    .map((h, i) => {
      const head = `[${i + 1}] brain/${h.file} (score ${h.score.toFixed(3)}, line ${h.line})`;
      return h.excerpt ? `${head}\n    ${h.excerpt}` : head;
    })
    .join("\n");
}

/** Run a brain search and return JSON-serializable hits (file path repo-relative). */
export function runBrainSearch(query: string, limit = 5): Array<{ file: string; score: number; line: number; excerpt: string }> {
  return brainSearch(query, defaultBrainDir(), limit).map((h) => ({
    file: `brain/${h.file}`,
    score: Number(h.score.toFixed(4)),
    line: h.line,
    excerpt: h.excerpt,
  }));
}

/**
 * Register the `brain` command group on a commander program. B2's CLI shell calls this.
 *   truffle brain search "<query>" [--limit N] [--json]
 */
export function registerBrainCommand(program: Command): void {
  const brain = program.command("brain").description("query truffle's expertise brain (BM25 over brain/*.md)");

  brain
    .command("search <query>")
    .description("BM25 search over brain/*.md — returns ranked hits with file + excerpt")
    .option("-l, --limit <n>", "max hits", "5")
    .option("--json", "emit JSON", false)
    .action((query: string, opts: { limit: string; json: boolean }) => {
      const limit = Number(opts.limit) || 5;
      if (opts.json) {
        process.stdout.write(JSON.stringify(runBrainSearch(query, limit), null, 2) + "\n");
        return;
      }
      const hits = brainSearch(query, defaultBrainDir(), limit);
      process.stdout.write(formatHits(hits, query) + "\n");
      // Non-zero only on a hard error; an empty result set is a valid (exit 0) outcome.
    });
}
