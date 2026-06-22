// src/runtime/corpus.ts — load the fixture corpus + the committed fixture vectors (E2's data, shared by E4/E1).
//
// The fixture corpus (fixtures/corpus/*.md) ships with COMMITTED fixture vectors (fixtures/vectors/*.json) so the
// hybrid (BM25 + vector → RRF) path runs in CI with ZERO embed-API calls (D15 / PLAN §5 Q0). This module is the
// single source for: parsing a corpus doc (frontmatter id/category/title + body), loading the per-doc fixture
// embedding, and loading the per-query fixture embedding. index-corpus / search / eval all read through here so the
// fixture data has exactly one loader. Pure file IO, no engine, no API call. NOT real model output — see
// fixtures/vectors/embeddings.json _comment.

import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";

/** One fixture document: its stable id, facet category, title, body, and (when present) the committed vector. */
export interface CorpusDoc {
  id: string;
  category: string;
  title: string;
  body: string;
  /** The committed fixture embedding for this doc (E2). Undefined if the doc has no fixture vector. */
  vector?: number[];
}

/** Parse a tiny YAML-ish frontmatter block (id/category/title) — no YAML dep; the fixtures use simple `key: value`. */
function parseFrontmatter(raw: string): { meta: Record<string, string>; body: string } {
  const meta: Record<string, string> = {};
  if (!raw.startsWith("---")) return { meta, body: raw };
  const end = raw.indexOf("\n---", 3);
  if (end === -1) return { meta, body: raw };
  const block = raw.slice(3, end).trim();
  for (const line of block.split("\n")) {
    const idx = line.indexOf(":");
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    const value = line.slice(idx + 1).trim();
    if (key) meta[key] = value;
  }
  const body = raw.slice(end + 4).trim();
  return { meta, body };
}

/** Load the committed per-doc fixture embeddings (E2). Returns id → vector. Empty if the file is absent. */
export function loadFixtureEmbeddings(repoRoot: string = process.cwd()): Record<string, number[]> {
  const path = join(repoRoot, "fixtures", "vectors", "embeddings.json");
  if (!existsSync(path)) return {};
  const parsed = JSON.parse(readFileSync(path, "utf8")) as { embeddings?: Record<string, number[]> };
  return parsed.embeddings ?? {};
}

/** Load the committed per-query fixture embeddings (E2). Returns query string → vector. Empty if absent. */
export function loadFixtureQueryVectors(repoRoot: string = process.cwd()): Record<string, number[]> {
  const path = join(repoRoot, "fixtures", "vectors", "queries.json");
  if (!existsSync(path)) return {};
  const parsed = JSON.parse(readFileSync(path, "utf8")) as { queries?: Record<string, number[]> };
  return parsed.queries ?? {};
}

/** The golden expectations (E2): judgements + the hybrid-ordering proof + the lexical-ID ranking. */
export interface GoldenExpectations {
  judgements: Array<{ query: string; relevant: string[] }>;
  hybridOrderingProof: { query: string; bm25AloneTopId: string; hybridTopId: string; note?: string };
  lexicalIdRanking: { query: string; above: string; below: string; note?: string };
}

/** Load fixtures/golden-expectations.json (E2). Throws if absent — the eval cannot score without ground truth. */
export function loadGoldenExpectations(repoRoot: string = process.cwd()): GoldenExpectations {
  const path = join(repoRoot, "fixtures", "golden-expectations.json");
  const parsed = JSON.parse(readFileSync(path, "utf8")) as Partial<GoldenExpectations>;
  if (!parsed.judgements || !parsed.hybridOrderingProof || !parsed.lexicalIdRanking) {
    throw new Error(`golden-expectations.json at ${path} is missing required keys (judgements/hybridOrderingProof/lexicalIdRanking)`);
  }
  return parsed as GoldenExpectations;
}

/**
 * Load the fixture corpus: every *.md under `corpusDir`, parsed into a CorpusDoc with its committed vector attached.
 * Deterministic order (sorted by filename → stable id order). The doc id comes from frontmatter `id:`; if absent,
 * the filename stem is used (so a corpus without frontmatter still indexes).
 */
export function loadCorpus(corpusDir: string, repoRoot: string = process.cwd()): CorpusDoc[] {
  const embeddings = loadFixtureEmbeddings(repoRoot);
  const files = readdirSync(corpusDir)
    .filter((f) => f.endsWith(".md"))
    .sort();
  const docs: CorpusDoc[] = [];
  for (const f of files) {
    const raw = readFileSync(join(corpusDir, f), "utf8");
    const { meta, body } = parseFrontmatter(raw);
    const id = meta.id ?? f.replace(/\.md$/, "");
    const category = meta.category ?? "uncategorized";
    const title = meta.title ?? id;
    const doc: CorpusDoc = { id, category, title, body };
    const vec = embeddings[id];
    if (vec) doc.vector = vec;
    docs.push(doc);
  }
  return docs;
}

/** The fixture embedder dimensionality (the committed vectors are 8-dim concept axes). Single source for the dim. */
export const FIXTURE_DIMS = 8;

/** Resolve the default fixture corpus dir relative to the repo root (cwd). */
export function defaultCorpusDir(repoRoot: string = process.cwd()): string {
  return join(repoRoot, "fixtures", "corpus");
}
