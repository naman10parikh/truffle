// src/sandbox/engine-up.ts — boot an isolated ephemeral search engine (E4 / §11 sandbox).
//
// truffle's true sandbox is an EPHEMERAL SEARCH ENGINE, not a code sandbox (HARNESS-OVERRIDES §11 override):
// "E2B Firecracker" is satisfied by any isolated ephemeral engine truffle provisions. The DEFAULT is a
// `getmeili/meilisearch:v1.28` container (identical to a hosted Meili, free, reproducible, zero secrets — the
// same image the acceptance/rsi CI `services:` block uses). Typesense / Postgres+pgvector containers are the
// documented alt/G4 paths (truffle drives them via REST/SQL; only Meili is wired as the default this wave).
//
// This module shells out to `docker run` (Docker is the local equivalent of the CI `services:` block) and waits
// for the engine's health probe. Cold start is measured + printed. In CI the container is already up via
// `services:`, so `truffle engine up` is the LOCAL convenience; both paths converge on the same MeiliClient.

import { spawn } from "node:child_process";
import { MeiliClient, meiliConfigFromEnv } from "../runtime/meili-client.js";

/** The pinned Meili image — identical to the CI `services:` block (PLAN §5). doctor feature-detects the version. */
export const MEILI_IMAGE = "getmeili/meilisearch:v1.28";
const MEILI_CONTAINER = "truffle-meili";

/** Run a command, resolving with {code, stdout, stderr}. Never throws on a non-zero exit (caller decides). */
function run(cmd: string, args: string[]): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d) => (stdout += d.toString()));
    child.stderr.on("data", (d) => (stderr += d.toString()));
    child.on("error", (e) => resolve({ code: 127, stdout, stderr: stderr + String(e) }));
    child.on("close", (code) => resolve({ code: code ?? 0, stdout, stderr }));
  });
}

/** Poll the engine health until available or the deadline. Returns the cold-start ms. */
async function waitHealthy(client: MeiliClient, timeoutMs = 60_000): Promise<number> {
  const start = Date.now();
  const deadline = start + timeoutMs;
  for (;;) {
    if (await client.health()) return Date.now() - start;
    if (Date.now() > deadline) throw new Error(`engine did not become healthy within ${timeoutMs}ms`);
    await new Promise((r) => setTimeout(r, 250));
  }
}

/**
 * Boot the default Meili container (or report the alt path for typesense/postgres). Idempotent: if the engine is
 * already healthy (CI `services:` block, or a prior `engine up`), it short-circuits. Prints the cold-start time.
 */
export async function engineUp(engine: string): Promise<void> {
  if (engine !== "meili") {
    // Typesense/Postgres are documented alt paths driven via REST/SQL; only Meili is the wired default this wave
    // (PLAN §7 / HARNESS-OVERRIDES §11). Be honest rather than pretend-boot an engine truffle doesn't yet wire — and
    // FAIL (throw → non-zero exit), don't return success: a script/CI asking for an unwired engine must not see exit 0.
    throw new Error(
      `only the Meili default is wired this wave. For the ${engine} path run a ` +
        `container directly (e.g. \`docker run -p 8108:8108 typesense/typesense:28.0\` / \`docker run -p 5432:5432 supabase/postgres\`) ` +
        `and point truffle at it via env — see HARNESS-OVERRIDES §11.`,
    );
  }

  const cfg = meiliConfigFromEnv();
  const client = new MeiliClient(cfg);

  // Already healthy? (CI services: block, or a previous boot) — short-circuit, no Docker needed.
  if (await client.health()) {
    process.stdout.write(`Meili already healthy at ${cfg.url} — reusing it (no container started).\n`);
    return;
  }

  // Is Docker available?
  const docker = await run("docker", ["--version"]);
  if (docker.code !== 0) {
    throw new Error(
      `Docker not available (\`docker --version\` exited ${docker.code}). In CI the engine comes from the ` +
        `\`services:\` block; locally install Docker, or run \`docker run -p 7700:7700 ${MEILI_IMAGE}\` manually.`,
    );
  }

  // Remove any stale container with our name (ignore failure if none).
  await run("docker", ["rm", "-f", MEILI_CONTAINER]);

  // Boot the pinned Meili image, detached, with the master key + analytics off (matches the CI services env).
  process.stdout.write(`booting ${MEILI_IMAGE} (container ${MEILI_CONTAINER}) on ${cfg.url} …\n`);
  const up = await run("docker", [
    "run",
    "-d",
    "--name",
    MEILI_CONTAINER,
    "-p",
    "7700:7700",
    "-e",
    `MEILI_MASTER_KEY=${cfg.masterKey}`,
    "-e",
    "MEILI_NO_ANALYTICS=true",
    MEILI_IMAGE,
  ]);
  if (up.code !== 0) throw new Error(`docker run ${MEILI_IMAGE} failed (exit ${up.code}): ${up.stderr.trim()}`);

  const coldStartMs = await waitHealthy(client);
  process.stdout.write(`Meili healthy in ${coldStartMs}ms (cold start) at ${cfg.url}. Container: ${MEILI_CONTAINER}.\n`);
}

/** Tear down the truffle Meili container (used by the local acceptance smoke + tests; never touches CI services). */
export async function engineDown(): Promise<void> {
  await run("docker", ["rm", "-f", MEILI_CONTAINER]);
}
