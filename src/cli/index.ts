#!/usr/bin/env node
// index.ts — the `truffle` CLI shell (commander). The employee's hands.
//
// Registers the full command tree (PLAN §4): index · search · engine select|up · hybrid design|fuse ·
// facet plan · rerank advise · embed advise · tenant key · eval · doctor · brain search. The deterministic verbs
// (engine select, hybrid, facet, rerank, embed, tenant, brain) run pure-code cores (B3 / A6b); the engine-touching
// verbs (index, search, eval, doctor, engine up) delegate to the E1-E4 runtime/sandbox modules, with an honest
// not-yet-wired exit until those land. Exit 0 on success / non-zero on violation. --version from package.json.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { Command } from "commander";
import { registerEngineCommand } from "./commands/engine.js";
import { registerHybridCommand } from "./commands/hybrid.js";
import { registerAdviseCommands } from "./commands/advise.js";
import { registerRuntimeCommands } from "./commands/runtime.js";
import { registerBrainCommand } from "./commands/brain.js";
import { registerRouteCommand } from "./commands/route.js";

/** Read the package version so `truffle --version` matches package.json (dist/cli → repo root is two up). */
function readVersion(): string {
  try {
    const here = dirname(fileURLToPath(import.meta.url));
    const pkg = JSON.parse(readFileSync(join(here, "..", "..", "package.json"), "utf8")) as { version?: string };
    return pkg.version ?? "0.0.0";
  } catch {
    return "0.0.0";
  }
}

const program = new Command();

program
  .name("truffle")
  .description("truffle — the search employee: typo-tolerant, faceted, relevance-ranked hybrid (BM25+vector) search you can prove")
  .version(readVersion(), "-v, --version", "print the truffle version");

// The full §4 command tree.
registerRuntimeCommands(program); // index · search · eval · doctor (engine-touching, delegate to E1-E4)
registerEngineCommand(program); //   engine select (deterministic) · engine up (E4)
registerHybridCommand(program); //   hybrid design · hybrid fuse (deterministic, B3 fusion)
registerAdviseCommands(program); //  facet plan · rerank advise · embed advise · tenant key (deterministic)
registerBrainCommand(program); //    brain search (A6b BM25 over brain/*.md)
registerRouteCommand(program); //     route run (D1 internal dispatch loop: index → search → eval, ordered)

program.parseAsync(process.argv);
