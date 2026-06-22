// route.ts — the `truffle route run` CLI verb: run the internal dispatch loop (D1).
//
// Surfaces the deterministic index→search→eval routing loop (src/dispatch/route.ts) as a `truffle` verb so the
// routed flow is invokable from the binary. Each step is logged in order to logs/runs.jsonl (the dispatch loop
// "logs each step"). The route is honest about engine state: engine-touching steps report "engine-pending" until
// Cluster E lands — it never fabricates a green eval. Source: PLAN §3 Dispatch · MASTER-TODOS D1.

import type { Command } from "commander";
import { routeSearchJob } from "../../dispatch/route.js";

/** Register `route run` on the program. */
export function registerRouteCommand(program: Command): void {
  const route = program.command("route").description("internal multi-step routing loop (index → search → eval)");

  route
    .command("run")
    .description("route a search job in order (index → search → eval), logging each ordered step to logs/runs.jsonl")
    .option("--json", "emit the ordered step records as JSON", false)
    .action(async (opts: { json: boolean }) => {
      const result = await routeSearchJob();
      if (opts.json) {
        process.stdout.write(JSON.stringify(result, null, 2) + "\n");
        return;
      }
      process.stdout.write(`routed job ${result.job} — ${result.steps.length} ordered steps:\n`);
      for (const s of result.steps) {
        process.stdout.write(`  [${s.seq}] ${s.step} → ${s.status}: ${s.detail}\n`);
      }
      // The route itself succeeds (it routed + logged in order); an engine-pending step is honest state, not a
      // route failure — so exit 0. A real "error" status (a built module threw) is the only non-zero case.
      if (result.steps.some((s) => s.status === "error")) process.exitCode = 1;
    });
}
