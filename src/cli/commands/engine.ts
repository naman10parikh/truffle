// engine.ts — the `truffle engine select|up` command group.
//
//   truffle engine select  → corpus-size/control decision tree (DETERMINISTIC, delegates to B3's engine-selector).
//   truffle engine up       → boot an ephemeral engine container (the live-engine path — owned by E4's sandbox
//                             layer; this shell registers the verb + args and delegates to engineUp() once it lands).
//
// --json on `engine select` (agent consumption). Source: PLAN §4 CLI tree.

import type { Command } from "commander";
import { selectEngine, type EngineSelectInput } from "../../core/engine-selector.js";

/** Register `engine select` + `engine up` on the program. */
export function registerEngineCommand(program: Command): void {
  const engine = program.command("engine").description("engine selection + ephemeral-engine lifecycle");

  engine
    .command("select")
    .description("corpus-size/control decision tree → engine + honest cost + right-size verdict")
    .option("--corpus-size <n>", "document count in the corpus", "0")
    .option("--multitenant", "multi-tenant product (per-tenant scoped search)", false)
    .option("--latency-critical", "sub-50ms / autocomplete latency requirement", false)
    .option("--on-postgres", "already running Postgres (one-fewer-service path)", false)
    .option("--offline", "offline corpus an agent greps (the S16 BM25 litmus)", false)
    .option("--ops-appetite <level>", "ops appetite: low|high", "low")
    .option("--json", "emit JSON", false)
    .action((opts: {
      corpusSize: string;
      multitenant: boolean;
      latencyCritical: boolean;
      onPostgres: boolean;
      offline: boolean;
      opsAppetite: string;
      json: boolean;
    }) => {
      const input: EngineSelectInput = {
        corpusSize: Number(opts.corpusSize) || 0,
        multitenant: opts.multitenant,
        latencyCritical: opts.latencyCritical,
        onPostgres: opts.onPostgres,
        offline: opts.offline,
        opsAppetite: opts.opsAppetite === "high" ? "high" : "low",
      };
      const result = selectEngine(input);
      if (opts.json) {
        process.stdout.write(JSON.stringify(result, null, 2) + "\n");
        return;
      }
      process.stdout.write(
        `engine: ${result.engine}\n` +
          `reason: ${result.reason}\n` +
          `honest cost: ${result.honestCost}\n` +
          `right-size: ${result.rightsizeVerdict}\n` +
          `rejected:\n${result.rejected.map((r) => `  - ${r}`).join("\n")}\n`,
      );
    });

  engine
    .command("up")
    .description("boot an ephemeral engine container (dev/CI); default Meilisearch")
    .option("--engine <e>", "meili|typesense|postgres", "meili")
    .action(async (opts: { engine: string }) => {
      // The live-engine lifecycle is E4's sandbox component (src/sandbox/engine-up.ts). The shell + args are wired
      // here; until E4 lands the boot logic this is an HONEST not-yet-wired exit, never a fake success. The path is
      // passed as a variable so tsc treats it as a runtime-resolved dynamic import (E4 adds the module later).
      const sandboxPath = "../../sandbox/engine-up.js";
      let mod: { engineUp: (e: string) => Promise<void> } | undefined;
      try {
        mod = (await import(sandboxPath)) as { engineUp: (e: string) => Promise<void> };
      } catch {
        // The sandbox module itself is missing (would only happen pre-E4 / a broken build) — the honest not-wired note.
        process.stderr.write(
          `truffle engine up --engine ${opts.engine}: the ephemeral-engine lifecycle (src/sandbox/engine-up.ts) ` +
            `is the E4 sandbox component and is not wired yet. Use \`docker run -p 7700:7700 getmeili/meilisearch:v1.28\` meanwhile.\n`,
        );
        process.exitCode = 2;
        return;
      }
      try {
        await mod.engineUp(opts.engine);
      } catch (err) {
        // engineUp threw a real, specific reason (e.g. an unwired engine, or Docker unavailable) — surface IT, and
        // FAIL (non-zero) so a script/CI never treats an unwired/failed engine as up.
        process.stderr.write(`truffle engine up --engine ${opts.engine}: ${err instanceof Error ? err.message : String(err)}\n`);
        process.exitCode = 2;
      }
    });
}
