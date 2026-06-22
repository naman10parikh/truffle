// src/runtime/index-corpus.ts — `truffle index` (CLI) + `truffle_index` (MCP): index a corpus into the engine.
//
// Half of THE acceptance bar (PLAN §5). Loads the fixture corpus + COMMITTED fixture vectors (E2, via corpus.ts),
// configures the Meili index (P2 — declare attributes EXPLICITLY; a userProvided `hybrid` embedder so the vector
// leg runs with NO embed-API call, D15), POSTs the docs with `_vectors`, and POLLS the task queue to `succeeded`
// before reporting `searchable:true` (P1/S9 — Meili writes are ASYNC; never assume searchability before the task
// finishes). Exit/throw on failure — NEVER report searchable without the task succeeding (Wave V re-runs this).
//
// Exports BOTH `index` (the CLI shape: src/cli/commands/runtime.ts calls `m.index(path, {engine, hybrid})`) and
// `indexCorpus` (the MCP shape: src/mcp/tools/runtime-tools.ts calls `m.indexCorpus(path[], {engine, hybrid})`).
// Both converge on one implementation so the CLI and MCP index identically.

import { MeiliClient, meiliConfigFromEnv } from "./meili-client.js";
import { loadCorpus, FIXTURE_DIMS } from "./corpus.js";

/** The fixed Meili index name truffle's fixture/acceptance flow uses. Single source for index + search + eval. */
export const FIXTURE_INDEX = "truffle_fixture";

export interface IndexOptions {
  engine: string;
  hybrid: boolean;
}

export interface IndexResult {
  indexed: number;
  /** TRUE only after the Meili task reached `succeeded` (the P1/S9 contract — searchability is proven, not assumed). */
  searchable: boolean;
  taskStatus: string;
  engine: string;
  hybrid: boolean;
}

/** The core indexer both entry points call. Throws on any failure; returns the proven-searchable result. */
async function indexCore(corpusPath: string, opts: IndexOptions): Promise<IndexResult> {
  if (opts.engine !== "meili") {
    // Only Meili is wired this wave (PLAN §7). Be honest — don't pretend to index into an unwired engine.
    throw new Error(`engine "${opts.engine}" is not wired this wave — only meili. See HARNESS-OVERRIDES §11 for the alt paths.`);
  }
  const client = new MeiliClient(meiliConfigFromEnv());
  if (!(await client.health())) {
    throw new Error(
      `Meili is not reachable. Boot it first: \`truffle engine up --engine meili\` (or in CI the services: block). ` +
        `MEILI_URL=${process.env.MEILI_URL ?? "http://localhost:7700"}.`,
    );
  }

  const docs = loadCorpus(corpusPath);
  if (docs.length === 0) throw new Error(`no *.md docs found under ${corpusPath}`);

  // Build + VALIDATE the Meili documents BEFORE touching the engine. When --hybrid, attach the COMMITTED fixture
  // vector as a userProvided embedding ({embeddings, regenerate:false}) so the vector leg needs NO embed API (D15).
  // A doc missing a fixture vector under --hybrid fails loudly HERE (no engine mutation yet) rather than silently
  // indexing a half-hybrid corpus or letting the settings re-embed step fail with a cryptic Meili task error.
  const meiliDocs = docs.map((d) => {
    const base: Record<string, unknown> = { id: d.id, title: d.title, category: d.category, body: d.body };
    if (opts.hybrid) {
      if (!d.vector)
        throw new Error(
          `--hybrid needs a vector for doc "${d.id}", but none was found. This wave runs hybrid on COMMITTED fixture ` +
            `vectors only (secret-less, deterministic CI per D15) — they live in fixtures/vectors/embeddings.json and ` +
            `cover the fixture corpus. For YOUR OWN corpus you have two options: (1) drop --hybrid to index BM25-only ` +
            `(keyword + typo-tolerant, no vectors needed); or (2) wait for the live-embedder path (OPENAI_API_KEY, ` +
            `Wave-V/additive — not in this CI gate). See HARNESS-OVERRIDES §Acceptance + PLAN §5 Q0.`,
        );
      if (d.vector.length !== FIXTURE_DIMS) throw new Error(`doc ${d.id} fixture vector is ${d.vector.length}-dim, expected ${FIXTURE_DIMS}`);
      base._vectors = { hybrid: { embeddings: d.vector, regenerate: false } };
    }
    return base;
  });

  // REPLACE semantics: clear the prior corpus first so the index reflects exactly THIS corpus (truffle's index name
  // is fixed — without this, indexing corpus B leaves corpus A's docs mixed in, and a leftover BM25 doc with no
  // vector breaks a subsequent --hybrid run when configureIndex re-embeds existing docs). Delete BEFORE configure so
  // the embedder change never re-embeds stale docs. No-op when the index doesn't exist yet (404).
  await client.deleteAllDocuments(FIXTURE_INDEX);

  // Configure attributes (P2) + the hybrid embedder (only when --hybrid; reset when BM25-only). Polls each settings
  // task to succeeded.
  await client.configureIndex(FIXTURE_INDEX, opts.hybrid);

  const task = await client.addDocumentsAndWait(FIXTURE_INDEX, meiliDocs);
  return {
    indexed: docs.length,
    searchable: task.status === "succeeded",
    taskStatus: task.status,
    engine: opts.engine,
    hybrid: opts.hybrid,
  };
}

/** CLI entry (`truffle index <path>`): index + print a human/JSON summary. Sets a non-zero exit on failure. */
export async function index(path: string, opts: IndexOptions): Promise<void> {
  try {
    const result = await indexCore(path, opts);
    process.stdout.write(
      `indexed ${result.indexed} docs into ${FIXTURE_INDEX} (engine=${result.engine}, hybrid=${result.hybrid}); ` +
        `task ${result.taskStatus} → searchable=${result.searchable}\n`,
    );
  } catch (err) {
    process.stderr.write(`truffle index failed: ${err instanceof Error ? err.message : String(err)}\n`);
    process.exitCode = 1;
  }
}

/** MCP entry (`truffle_index`): index + return the structured result object (no fabrication — throws propagate). */
export async function indexCorpus(paths: string[], opts: IndexOptions): Promise<IndexResult> {
  // The MCP passes an array; truffle indexes one corpus dir (the first path). Multi-dir is out of scope this wave.
  const path = paths[0];
  if (!path) throw new Error("truffle_index requires a corpus path");
  return indexCore(path, opts);
}
