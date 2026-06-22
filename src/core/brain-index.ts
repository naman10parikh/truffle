// brain-index.ts — a real Okapi BM25 index/search over brain/*.md (the Memory queryable layer).
//
// This is the in-house-BM25 case truffle KEEPS on purpose (a few hundred offline notes — the litmus test
// from brain/OPINIONS.md O2 / brain/BATTLE-TESTED-SCENARIOS.md S16: an agent grepping its own notes offline
// → keep the in-house BM25; do NOT stand up a Meili server for the brain). truffle's *product* search uses
// real engines; truffle's *own brain* is the deliberate BM25 demonstration of the boundary.
//
// Okapi BM25, k1=1.5, b=0.75 (the textbook-correct defaults). Returns ranked hits with file + excerpt.
// Pure code, no LLM call. Wired into the CLI `truffle brain search` verb via src/cli/commands/brain.ts.

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, basename } from "node:path";

const K1 = 1.5;
const B = 0.75;

export interface BrainHit {
  /** Repo-relative path to the brain file. */
  file: string;
  /** BM25 score (higher = more relevant). */
  score: number;
  /** A short excerpt around the best-matching line. */
  excerpt: string;
  /** 1-based line number of the best-matching line (for excerpt anchoring). */
  line: number;
}

interface Doc {
  file: string;
  /** Lowercased token list for scoring. */
  tokens: string[];
  /** Per-token frequency. */
  tf: Map<string, number>;
  length: number;
  /** Original lines (for excerpt extraction). */
  lines: string[];
}

/** Split a string into lowercased alphanumeric tokens (codes/SKUs like `0x80070005`, `rtx-4090` survive). */
export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9_-]+/)
    .filter((t) => t.length > 0);
}

/** Build the in-memory BM25 index over every *.md under brainDir (non-recursive — the brain is flat). */
function buildIndex(brainDir: string): Doc[] {
  const docs: Doc[] = [];
  let entries: string[];
  try {
    entries = readdirSync(brainDir);
  } catch {
    return docs;
  }
  for (const name of entries) {
    if (!name.endsWith(".md")) continue;
    const full = join(brainDir, name);
    let st;
    try {
      st = statSync(full);
    } catch {
      continue;
    }
    if (!st.isFile()) continue;
    const raw = readFileSync(full, "utf8");
    const lines = raw.split("\n");
    const tokens = tokenize(raw);
    const tf = new Map<string, number>();
    for (const t of tokens) tf.set(t, (tf.get(t) ?? 0) + 1);
    docs.push({ file: name, tokens, tf, length: tokens.length, lines });
  }
  return docs;
}

/** Inverse document frequency (BM25 form, with the +1 smoothing to keep it non-negative). */
function idf(term: string, docs: Doc[]): number {
  let n = 0;
  for (const d of docs) if (d.tf.has(term)) n += 1;
  const N = docs.length;
  return Math.log(1 + (N - n + 0.5) / (n + 0.5));
}

/** Find the best-matching line + a 2-line context window for the excerpt. */
function bestExcerpt(doc: Doc, queryTerms: string[]): { line: number; excerpt: string } {
  let bestLine = 0;
  let bestScore = 0;
  for (let i = 0; i < doc.lines.length; i++) {
    const lineTokens = new Set(tokenize(doc.lines[i] ?? ""));
    let s = 0;
    for (const q of queryTerms) if (lineTokens.has(q)) s += 1;
    if (s > bestScore) {
      bestScore = s;
      bestLine = i;
    }
  }
  const start = Math.max(0, bestLine - 1);
  const end = Math.min(doc.lines.length - 1, bestLine + 1);
  const excerpt = doc.lines
    .slice(start, end + 1)
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
    .join(" ")
    .slice(0, 240);
  return { line: bestLine + 1, excerpt };
}

/**
 * Rank brain/*.md by Okapi BM25 against the query. Returns the top `limit` hits with file + excerpt.
 * Deterministic: same corpus + query → same ranking.
 */
export function brainSearch(query: string, brainDir: string, limit = 5): BrainHit[] {
  const docs = buildIndex(brainDir);
  if (docs.length === 0) return [];
  const avgdl = docs.reduce((sum, d) => sum + d.length, 0) / docs.length;
  const queryTerms = tokenize(query);
  if (queryTerms.length === 0) return [];

  const idfCache = new Map<string, number>();
  for (const term of queryTerms) if (!idfCache.has(term)) idfCache.set(term, idf(term, docs));

  const scored: BrainHit[] = docs.map((d) => {
    let score = 0;
    for (const term of queryTerms) {
      const f = d.tf.get(term) ?? 0;
      if (f === 0) continue;
      const termIdf = idfCache.get(term) ?? 0;
      const denom = f + K1 * (1 - B + (B * d.length) / avgdl);
      score += termIdf * ((f * (K1 + 1)) / denom);
    }
    const { line, excerpt } = bestExcerpt(d, queryTerms);
    return { file: d.file, score, excerpt, line };
  });

  return scored
    .filter((h) => h.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

/** Resolve the canonical brain dir relative to the repo root (the package's own brain/). */
export function defaultBrainDir(): string {
  // src/core/brain-index.ts → repo root is two dirs up from dist/core at runtime; resolve from cwd's brain/.
  return join(process.cwd(), "brain");
}
