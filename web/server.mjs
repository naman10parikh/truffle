// web/server.mjs — truffle cockpit: a zero-dependency Node `http` server (PLAN §10, the proven
// sentinel/talent-intel stdlib pattern, in Node here because truffle is a Node package). Read-mostly,
// for the chairman's eyes only [D3] — NOT an agent surface (agents drive truffle via the CLI + MCP).
//
// Serves the vanilla-JS SPA (web/index.html + app.js + style.css) and a small JSON API that feeds the 4
// views from REAL repo data (not lorem):
//   GET  /api/brain/list           → the brain/*.md files + MOC, for the Brain browser nav
//   GET  /api/brain/doc?file=NAME  → one brain file's raw markdown (rendered client-side)
//   GET  /api/brain/search?q=...   → BM25 over brain/ via the compiled dist/core/brain-index.js (pure, no engine)
//   GET  /api/runs                 → tail of logs/runs.jsonl (the Run log — relevance verdict + engine/fusion)
//   GET  /api/evals                → the golden-task grid + acceptance/version-bump status (Eval scores)
//   POST /api/ask {mode,query}     → Ask the employee: brain-search (always) / engine-select / search (engine-gated)
//
// Boundary discipline: the brain-search + engine-select paths are pure deterministic code (no engine, no key);
// the `search` path shells out to the `truffle` CLI and DEGRADES GRACEFULLY when Meili is down (returns a clear
// "engine not booted" note rather than a stack trace). The server NEVER fabricates hits.

import { createServer } from "node:http";
import { readFile, readdir, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, extname, basename, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, "..");
const WEB_DIR = __dirname;
const BRAIN_DIR = join(REPO_ROOT, "brain");
const RUNS_FILE = join(REPO_ROOT, "logs", "runs.jsonl");
const GOLDEN_FILE = join(REPO_ROOT, "eval", "golden", "golden-tasks.json");
const TYPO_FILE = join(REPO_ROOT, "eval", "golden", "typo-set.json");

const PORT = Number(process.env.TRUFFLE_WEB_PORT || process.env.PORT || 7787);

// --- the compiled BM25 brain index (pure, no engine). If dist isn't built yet, the brain-search path says so. ---
let brainSearchFn = null;
let defaultBrainDirFn = null;
const distBrainIndex = join(REPO_ROOT, "dist", "core", "brain-index.js");
if (existsSync(distBrainIndex)) {
  try {
    const mod = await import(distBrainIndex);
    brainSearchFn = mod.brainSearch;
    defaultBrainDirFn = mod.defaultBrainDir;
  } catch (err) {
    console.warn("[cockpit] could not load dist/core/brain-index.js — run `pnpm build`:", err.message);
  }
}

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
};

function sendJson(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Content-Length": Buffer.byteLength(payload) });
  res.end(payload);
}

function sendText(res, status, text, type = "text/plain; charset=utf-8") {
  res.writeHead(status, { "Content-Type": type });
  res.end(text);
}

// Run the `truffle` CLI (the same binary agents use). Resolves {code, stdout, stderr}; never throws.
function runTruffle(args, timeoutMs = 20_000) {
  return new Promise((resolve) => {
    // Prefer the repo's own built CLI so the cockpit reflects THIS repo, not a globally-linked older version.
    const localCli = join(REPO_ROOT, "dist", "cli", "index.js");
    const cmd = existsSync(localCli) ? process.execPath : "truffle";
    const fullArgs = existsSync(localCli) ? [localCli, ...args] : args;
    const child = spawn(cmd, fullArgs, { cwd: REPO_ROOT, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => child.kill("SIGKILL"), timeoutMs);
    child.stdout.on("data", (d) => (stdout += d.toString()));
    child.stderr.on("data", (d) => (stderr += d.toString()));
    child.on("error", (e) => {
      clearTimeout(timer);
      resolve({ code: 127, stdout, stderr: stderr + String(e) });
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({ code: code ?? 0, stdout, stderr });
    });
  });
}

// --- API: brain file list (the 6 artifacts + MOC + ORG_*), sorted MOC-first for the nav. ---
async function apiBrainList(res) {
  let names = [];
  try {
    names = (await readdir(BRAIN_DIR)).filter((n) => n.endsWith(".md"));
  } catch {
    return sendJson(res, 200, { files: [], note: "brain/ not found" });
  }
  // MOC first, then the expertise artifacts, then ORG_*, alpha within groups.
  const order = (n) => (n.startsWith("MOC") ? 0 : n.startsWith("ORG_") ? 2 : 1);
  names.sort((a, b) => order(a) - order(b) || a.localeCompare(b));
  sendJson(res, 200, { files: names });
}

// --- API: one brain doc's raw markdown (client renders it; wikilinks are rewritten client-side). ---
async function apiBrainDoc(res, file) {
  // Path-traversal guard: only a bare *.md filename directly under brain/ is allowed.
  if (!file || !/^[\w .()-]+\.md$/.test(file) || file.includes("..") || file.includes("/")) {
    return sendJson(res, 400, { error: "invalid file" });
  }
  const full = join(BRAIN_DIR, file);
  if (!full.startsWith(BRAIN_DIR) || !existsSync(full)) return sendJson(res, 404, { error: "not found" });
  try {
    const md = await readFile(full, "utf8");
    sendJson(res, 200, { file, markdown: md });
  } catch (err) {
    sendJson(res, 500, { error: err.message });
  }
}

// --- API: BM25 brain search (the same in-house BM25 the Memory component ships, S16 — pure, no engine). ---
function apiBrainSearch(res, q) {
  if (!q) return sendJson(res, 200, { query: "", hits: [] });
  if (!brainSearchFn) {
    return sendJson(res, 200, { query: q, hits: [], note: "brain index not built — run `pnpm build` then restart the cockpit" });
  }
  try {
    const hits = brainSearchFn(q, defaultBrainDirFn ? defaultBrainDirFn() : BRAIN_DIR, 8);
    sendJson(res, 200, { query: q, hits });
  } catch (err) {
    sendJson(res, 500, { error: err.message });
  }
}

// --- API: tail of logs/runs.jsonl (the Run log — model · duration · relevance verdict · engine+fusion). ---
async function apiRuns(res) {
  if (!existsSync(RUNS_FILE)) return sendJson(res, 200, { runs: [], note: "no runs yet — run `truffle eval --suite golden` or `truffle route run`" });
  try {
    const raw = await readFile(RUNS_FILE, "utf8");
    const lines = raw.split("\n").filter((l) => l.trim().length > 0);
    // Tail the last 200 lines, newest first.
    const tail = lines.slice(-200).reverse();
    const runs = [];
    for (const line of tail) {
      try {
        runs.push(JSON.parse(line));
      } catch {
        /* skip a malformed line rather than break the whole view */
      }
    }
    sendJson(res, 200, { runs });
  } catch (err) {
    sendJson(res, 500, { error: err.message });
  }
}

// --- API: the eval grid (golden tasks + the typo class) + the acceptance/version-bump status. ---
// Status is derived from the latest run records (honest: "pending" until an eval run has written a verdict).
async function apiEvals(res) {
  let tasks = [];
  try {
    tasks = JSON.parse(await readFile(GOLDEN_FILE, "utf8")).tasks || [];
  } catch {
    return sendJson(res, 200, { tasks: [], typoSet: [], acceptance: { status: "unknown" }, versionBump: { status: "unknown" } });
  }
  let typoSet = [];
  try {
    typoSet = JSON.parse(await readFile(TYPO_FILE, "utf8")).cases || JSON.parse(await readFile(TYPO_FILE, "utf8")).typos || [];
  } catch {
    /* typo set optional for the view */
  }

  // Derive acceptance + version-bump status from the latest run records (the relevance verdict the RSI loop acts on).
  let acceptance = { status: "pending", note: "run `node eval/eval.mjs` or `bash scripts/acceptance-local.sh`" };
  let versionBump = { status: "pending", note: "run `truffle eval --suite version-bump`" };
  let latestVerdict = null;
  if (existsSync(RUNS_FILE)) {
    try {
      const lines = (await readFile(RUNS_FILE, "utf8")).split("\n").filter((l) => l.trim());
      for (let i = lines.length - 1; i >= 0; i--) {
        let r;
        try {
          r = JSON.parse(lines[i]);
        } catch {
          continue;
        }
        // The relevance-verdict record (E3): carries recall_at_10 / mrr + engine + fusion.
        if (latestVerdict === null && (r.recall_at_10 !== undefined || r.mrr !== undefined)) {
          latestVerdict = r;
          const suite = r.suite || r.tool || "";
          // No regressions = undefined, the number 0, or an empty array. recall (if present) must clear the 0.8 gate.
          const noRegressions =
            r.regressions === undefined ||
            r.regressions === 0 ||
            (Array.isArray(r.regressions) && r.regressions.length === 0);
          const green = noRegressions && (r.recall_at_10 === undefined || r.recall_at_10 >= 0.8);
          if (String(suite).includes("version-bump")) {
            versionBump = { status: green ? "green" : "regressed", verdict: r };
          } else {
            acceptance = { status: green ? "green" : "red", verdict: r };
          }
        }
      }
    } catch {
      /* fall through to pending */
    }
  }
  sendJson(res, 200, { tasks, typoSet, acceptance, versionBump, latestVerdict });
}

// --- API: Ask the employee. mode ∈ {brain, engine, search}. ---
async function apiAsk(res, body) {
  let parsed;
  try {
    parsed = JSON.parse(body || "{}");
  } catch {
    return sendJson(res, 400, { error: "invalid JSON body" });
  }
  const mode = parsed.mode || "search";
  const query = (parsed.query || "").toString().slice(0, 500);
  if (!query.trim()) return sendJson(res, 400, { error: "empty query" });

  if (mode === "brain") {
    // Pure BM25 — always works, no engine, no key.
    if (!brainSearchFn) return sendJson(res, 200, { mode, query, error: "brain index not built (run `pnpm build`)" });
    const hits = brainSearchFn(query, defaultBrainDirFn ? defaultBrainDirFn() : BRAIN_DIR, 8);
    return sendJson(res, 200, { mode, query, hits });
  }

  if (mode === "engine") {
    // engine select — deterministic, no engine. We treat the free-text query as a corpus-size guess is wrong;
    // instead the SPA sends structured flags. Here we accept either a numeric corpus size or pass-through flags.
    const args = ["engine", "select", "--json"];
    const n = parseInt(query, 10);
    if (Number.isFinite(n)) args.push("--corpus-size", String(n));
    else args.push("--corpus-size", "50000"); // a sensible default if they typed prose
    if (parsed.multitenant) args.push("--multitenant");
    if (parsed.latencyCritical) args.push("--latency-critical");
    if (parsed.onPostgres) args.push("--on-postgres");
    const r = await runTruffle(args);
    let json = null;
    try {
      json = JSON.parse(r.stdout);
    } catch {
      /* leave json null, surface raw */
    }
    return sendJson(res, 200, { mode, query, result: json, raw: json ? undefined : r.stdout || r.stderr });
  }

  // mode === "search": shell out to the real CLI against the local Meili container. Degrade gracefully.
  const args = ["search", query, "--hybrid", "--facet", "category", "--top", "10", "--json"];
  const r = await runTruffle(args);
  if (r.code === 0) {
    try {
      const json = JSON.parse(r.stdout);
      return sendJson(res, 200, { mode: "search", query, result: json });
    } catch {
      return sendJson(res, 200, { mode: "search", query, raw: r.stdout });
    }
  }
  // Non-zero: almost always "Meili not reachable". Return the honest note so the view explains the boot step.
  return sendJson(res, 200, {
    mode: "search",
    query,
    engineDown: true,
    note: (r.stderr || r.stdout || "").trim() ||
      "search needs a booted engine — run `truffle engine up --engine meili` then `truffle index ./fixtures/corpus --hybrid`, or use Brain search (no engine required).",
  });
}

// --- static file serving (the SPA) ---
async function serveStatic(req, res, urlPath) {
  let rel = urlPath === "/" ? "/index.html" : urlPath;
  // Strip query string + guard traversal.
  rel = rel.split("?")[0];
  if (rel.includes("..")) return sendText(res, 400, "bad path");
  const full = join(WEB_DIR, rel);
  if (!full.startsWith(WEB_DIR) || !existsSync(full)) return sendText(res, 404, "not found");
  try {
    const s = await stat(full);
    if (s.isDirectory()) return sendText(res, 404, "not found");
    const data = await readFile(full);
    sendText(res, 200, data, MIME[extname(full)] || "application/octet-stream");
  } catch (err) {
    sendText(res, 500, "read error: " + err.message);
  }
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const path = url.pathname;
  try {
    if (req.method === "GET" && path === "/api/brain/list") return await apiBrainList(res);
    if (req.method === "GET" && path === "/api/brain/doc") return await apiBrainDoc(res, url.searchParams.get("file"));
    if (req.method === "GET" && path === "/api/brain/search") return apiBrainSearch(res, url.searchParams.get("q"));
    if (req.method === "GET" && path === "/api/runs") return await apiRuns(res);
    if (req.method === "GET" && path === "/api/evals") return await apiEvals(res);
    if (req.method === "GET" && path === "/api/health") return sendJson(res, 200, { ok: true, brainIndex: Boolean(brainSearchFn) });
    if (req.method === "POST" && path === "/api/ask") {
      let body = "";
      req.on("data", (c) => {
        body += c;
        if (body.length > 1e6) req.destroy(); // 1MB cap
      });
      req.on("end", () => apiAsk(res, body));
      return;
    }
    // everything else = static
    return await serveStatic(req, res, req.url);
  } catch (err) {
    sendJson(res, 500, { error: err.message });
  }
});

server.listen(PORT, () => {
  console.log(`truffle cockpit → http://localhost:${PORT}  (Ctrl-C to stop)`);
  console.log(`  brain index: ${brainSearchFn ? "loaded (BM25 over brain/)" : "NOT built — run `pnpm build`"}`);
});
