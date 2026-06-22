// scripts/cockpit-smoke.mjs — Playwright smoke for the truffle cockpit (CP123 Cluster G, G1 verify).
//
// Loads each of the 4 views, asserts each renders REAL data (not lorem), and captures a screenshot per view
// to content/screenshots/wave-v/ for Wave-V evidence. Uses the playwright-cli path (the global `playwright`
// install via NODE_PATH) — NOT the banned Playwright MCP [CLAUDE.md Tool Preferences].
//
// Usage:  node scripts/cockpit-smoke.mjs            (expects the cockpit already serving on $TRUFFLE_WEB_PORT|7787)
// Exit 0 = all 4 views passed; non-zero = a view failed its assertion.

import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, "..");
const SHOT_DIR = join(REPO_ROOT, "content", "screenshots", "wave-v");
const PORT = Number(process.env.TRUFFLE_WEB_PORT || 7787);
const BASE = `http://localhost:${PORT}`;

// Resolve playwright from the global install (the playwright-cli skill's runtime), falling back to local.
const require = createRequire(import.meta.url);
let chromium;
for (const p of [
  "playwright",
  "/usr/local/lib/node_modules/playwright",
  join(REPO_ROOT, "node_modules", "playwright"),
]) {
  try {
    ({ chromium } = require(p));
    break;
  } catch {
    /* try next */
  }
}
if (!chromium) {
  console.error("playwright not found — install with `npm i -g playwright` (the playwright-cli skill path)");
  process.exit(2);
}

mkdirSync(SHOT_DIR, { recursive: true });

const fails = [];
function assert(cond, msg) {
  if (cond) console.log(`  ✓ ${msg}`);
  else {
    console.error(`  ✗ ${msg}`);
    fails.push(msg);
  }
}

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });

try {
  // ---- View 1: Brain browser ----
  await page.goto(BASE, { waitUntil: "networkidle" });
  await page.waitForSelector("#brain-file-list li", { timeout: 8000 });
  const brainFiles = await page.$$eval("#brain-file-list li", (els) => els.map((e) => e.textContent));
  assert(brainFiles.length >= 6, `Brain: ${brainFiles.length} brain files listed (≥6)`);
  await page.waitForSelector("#brain-doc h1, #brain-doc h2", { timeout: 8000 });
  const brainHasContent = await page.$eval("#brain-doc", (e) => e.textContent.length > 200);
  assert(brainHasContent, "Brain: a brain doc rendered with real content");
  await page.screenshot({ path: join(SHOT_DIR, "01-brain.png"), fullPage: false });

  // ---- View 2: Run log ----
  await page.click('.tab[data-view="runs"]');
  await page.waitForSelector("#runs-table table.data, #runs-table p", { timeout: 8000 });
  const runsText = await page.$eval("#runs-table", (e) => e.textContent);
  assert(/R@10|relevance|engine-pending|index/.test(runsText), "Run log: shows run records (relevance verdict / steps)");
  await page.screenshot({ path: join(SHOT_DIR, "02-runs.png"), fullPage: false });

  // ---- View 3: Eval scores ----
  await page.click('.tab[data-view="evals"]');
  await page.waitForSelector("#eval-grid .eval-card", { timeout: 8000 });
  const evalCards = await page.$$eval("#eval-grid .eval-card", (els) => els.length);
  assert(evalCards >= 10, `Eval scores: ${evalCards} golden-task cards (≥10)`);
  const badges = await page.$eval("#eval-badges", (e) => e.textContent);
  assert(/G1|Acceptance/.test(badges), "Eval scores: acceptance badge present");
  await page.screenshot({ path: join(SHOT_DIR, "03-evals.png"), fullPage: false });

  // ---- View 4: Ask the employee (brain mode — always works, no engine needed) ----
  await page.click('.tab[data-view="ask"]');
  await page.waitForSelector("#ask-input", { timeout: 8000 });
  await page.fill("#ask-input", "filtered ANN under-return");
  await page.click("#ask-submit");
  await page.waitForSelector("#ask-result .hit-card", { timeout: 8000 });
  const askHits = await page.$$eval("#ask-result .hit-card", (els) => els.length);
  assert(askHits >= 1, `Ask: brain search returned ${askHits} hit(s)`);
  await page.screenshot({ path: join(SHOT_DIR, "04-ask.png"), fullPage: false });

  console.log(`\nScreenshots → ${SHOT_DIR}`);
} catch (err) {
  console.error("smoke error:", err.message);
  fails.push(err.message);
} finally {
  await browser.close();
}

if (fails.length) {
  console.error(`\nSMOKE FAILED (${fails.length}): ${fails.join("; ")}`);
  process.exit(1);
}
console.log("\nSMOKE PASS ✅ — all 4 cockpit views render real data + screenshots captured");
