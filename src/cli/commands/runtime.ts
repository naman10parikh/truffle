// runtime.ts — the engine-touching verbs: index · search · eval · doctor.
//
// These verbs RUN against a live/ephemeral engine (Meili container) + the fixture corpus + the golden eval. The
// engine lifecycle + indexing + the golden-suite + runs.jsonl logging are the E1-E4 components (src/sandbox/*,
// src/runtime/*, eval/*, scripts/log-run.mjs). B2 owns the CLI shell here: the verbs, the args, the --json flags,
// and HONEST delegation — when the runtime module isn't wired yet, exit non-zero with the reason, NEVER fake a
// success (Wave V re-runs these; fakes get caught). Source: PLAN §4 CLI tree + §5 acceptance.

import type { Command } from "commander";

/** Try to load a runtime module; on absence, write an honest not-yet-wired message and set a non-zero exit code. */
async function delegateOrExplain<T>(
  modulePath: string,
  componentOwner: string,
  run: (mod: T) => Promise<void> | void,
): Promise<void> {
  try {
    const mod = (await import(modulePath)) as T;
    await run(mod);
  } catch (err) {
    const reason = err instanceof Error && !/Cannot find module|ERR_MODULE_NOT_FOUND/.test(err.message) ? `: ${err.message}` : "";
    process.stderr.write(
      `not wired yet — ${componentOwner} owns ${modulePath}${reason}. ` +
        `This verb's CLI shell + args are in place; the engine/eval runtime lands with that component.\n`,
    );
    process.exitCode = 2;
  }
}

/** Register index · search · eval · doctor. */
export function registerRuntimeCommands(program: Command): void {
  program
    .command("index <path>")
    .description("index a corpus into the engine (chunk→embed→index, hybrid-ready); polls the task queue until searchable")
    .option("--engine <e>", "meili|typesense|postgres", "meili")
    .option("--hybrid", "index with the hybrid (BM25+vector) leg using committed fixture vectors", false)
    .action(async (path: string, opts: { engine: string; hybrid: boolean }) => {
      await delegateOrExplain<{ index: (p: string, o: { engine: string; hybrid: boolean }) => Promise<void> }>(
        "../../runtime/index-corpus.js",
        "E2/E4 (fixture corpus + engine lifecycle)",
        (m) => m.index(path, opts),
      );
    });

  program
    .command("search <query>")
    .description("hybrid (BM25+vector) search → typo-tolerant, faceted, relevance-ranked hits")
    .option("--engine <e>", "meili|typesense|postgres", "meili")
    .option("--hybrid", "use hybrid fusion (BM25 + vector → RRF)", false)
    .option("--facet <field...>", "facet by field(s)")
    .option("--filter <predicate>", "filter predicate")
    .option("--top <n>", "max hits", "10")
    .option("--json", "emit JSON", false)
    .action(async (query: string, opts: Record<string, unknown>) => {
      await delegateOrExplain<{ search: (q: string, o: Record<string, unknown>) => Promise<void> }>(
        "../../runtime/search.js",
        "E2/E4 (engine + fixture corpus)",
        (m) => m.search(query, opts),
      );
    });

  program
    .command("eval")
    .description("run the golden-query pyramid (+ the typo/lexical-ID/hybrid-scoring regression suite); Recall@10/MRR")
    .option("--suite <s>", "golden|version-bump", "golden")
    .option("--json", "emit JSON", false)
    .action(async (opts: { suite: string; json: boolean }) => {
      await delegateOrExplain<{ runEval: (o: { suite: string; json: boolean }) => Promise<void> }>(
        "../../runtime/eval-suite.js",
        "E1/E3 (golden tasks + eval pyramid + runs.jsonl)",
        (m) => m.runEval(opts),
      );
    });

  program
    .command("doctor")
    .description("health: engine version (gh-api-verified), pgvector≥0.8 + iterative_scan, attr declarations, RAM estimate, write-model")
    .option("--engine-url <url>", "engine URL to probe")
    .option("--json", "emit JSON", false)
    .action(async (opts: { engineUrl?: string; json: boolean }) => {
      await delegateOrExplain<{ doctor: (o: { engineUrl?: string; json: boolean }) => Promise<void> }>(
        "../../runtime/doctor.js",
        "E4 (engine probe)",
        (m) => m.doctor(opts),
      );
    });
}
