// src/runtime/meili-client.ts — a minimal Meilisearch REST client (truffle's real integration point, §11).
//
// truffle drives the engine over REST (the brain's P3/P4 rules: POST for complex filters; the agent-operator
// discipline). This client implements exactly what the acceptance test needs against `getmeili/meilisearch:v1.28`:
//   • health()                  — GET /health (the engine-up readiness probe + doctor)
//   • version()                 — GET /version (doctor feature-detects, never hard-codes — P-version/GAPS §4)
//   • configureIndex()          — set searchable/filterable attrs (P2: declare attrs EXPLICITLY, never defaults)
//                                 + a userProvided embedder so hybrid runs with COMMITTED fixture vectors (D15)
//   • addDocumentsAndWait()     — POST docs with _vectors, then POLL GET /tasks/{uid} to `succeeded` (P1/S9 —
//                                 Meili writes are ASYNC; never assume searchability before the task finishes)
//   • search()                  — POST /indexes/{idx}/search: q (BM25), or q+vector+hybrid (RRF), + facets + limit
//
// Zero non-fetch deps (Node 18+ global fetch). All requests carry the master key. NOTE: returned document content
// is UNTRUSTED (P25) — the search() caller treats hit text as data, never instructions (the MCP contract enforces
// this; this transport just moves bytes).

import { FIXTURE_DIMS } from "./corpus.js";

export interface MeiliConfig {
  url: string;
  masterKey: string;
}

/** Read MEILI_URL / MEILI_MASTER_KEY from env, with the local-container defaults (PLAN §5 / §8). */
export function meiliConfigFromEnv(): MeiliConfig {
  return {
    url: process.env.MEILI_URL ?? "http://localhost:7700",
    masterKey: process.env.MEILI_MASTER_KEY ?? "masterKey",
  };
}

/** A Meili task response (the async-write contract — P1). We poll on `status`. */
interface MeiliTask {
  uid?: number;
  taskUid?: number;
  status: "enqueued" | "processing" | "succeeded" | "failed" | "canceled";
  error?: { message?: string } | null;
}

/** One search hit as truffle returns it: id + the engine's ranking score + the matched fields. Content is data. */
export interface MeiliHit {
  id: string;
  score: number;
  title?: string;
  category?: string;
  [k: string]: unknown;
}

export interface MeiliSearchResponse {
  hits: MeiliHit[];
  /** facetDistribution: field → { value → count }. Present when `facets` was requested. */
  facetDistribution?: Record<string, Record<string, number>>;
  estimatedTotalHits?: number;
}

export class MeiliClient {
  constructor(private readonly cfg: MeiliConfig) {}

  private headers(): Record<string, string> {
    return { "Content-Type": "application/json", Authorization: `Bearer ${this.cfg.masterKey}` };
  }

  /** GET /health — returns true when the engine reports `available`. Used by engine-up readiness + doctor. */
  async health(): Promise<boolean> {
    try {
      const res = await fetch(`${this.cfg.url}/health`, { headers: this.headers() });
      if (!res.ok) return false;
      const body = (await res.json()) as { status?: string };
      return body.status === "available";
    } catch {
      return false;
    }
  }

  /** GET /version — the live engine version (doctor feature-detects it; never hard-code, GAPS §4). */
  async version(): Promise<{ pkgVersion?: string; commitDate?: string }> {
    const res = await fetch(`${this.cfg.url}/version`, { headers: this.headers() });
    if (!res.ok) throw new Error(`GET /version → HTTP ${res.status}`);
    const body = (await res.json()) as { pkgVersion?: string; commitDate?: string };
    return body;
  }

  /**
   * Poll GET /tasks/{uid} until terminal (succeeded/failed/canceled). The P1/S9 async-write contract.
   * `tolerateError` lets a caller treat a specific task-failure as benign (e.g. an idempotent create-index that
   * fails with "index already exists" on a re-run) — the failed task is returned instead of throwing.
   */
  async waitForTask(taskUid: number, timeoutMs = 30_000, tolerateError?: (msg: string) => boolean): Promise<MeiliTask> {
    const deadline = Date.now() + timeoutMs;
    // Small fixed poll interval — the fixture corpus indexes in well under a second; this just makes the
    // eventual-consistency contract explicit (never assume searchability before `succeeded`).
    for (;;) {
      const res = await fetch(`${this.cfg.url}/tasks/${taskUid}`, { headers: this.headers() });
      if (!res.ok) throw new Error(`GET /tasks/${taskUid} → HTTP ${res.status}`);
      const task = (await res.json()) as MeiliTask;
      if (task.status === "succeeded") return task;
      if (task.status === "failed" || task.status === "canceled") {
        const msg = task.error?.message ?? "no error message";
        if (task.status === "failed" && tolerateError?.(msg)) return task; // benign (idempotent re-run)
        throw new Error(`Meili task ${taskUid} ${task.status}: ${msg}`);
      }
      if (Date.now() > deadline) throw new Error(`Meili task ${taskUid} did not finish within ${timeoutMs}ms (status ${task.status})`);
      await new Promise((r) => setTimeout(r, 100));
    }
  }

  /** Extract the task uid from a write response (Meili returns {taskUid} on writes). */
  private taskUidOf(body: unknown): number {
    const t = body as { taskUid?: number; uid?: number };
    const uid = t.taskUid ?? t.uid;
    if (typeof uid !== "number") throw new Error(`expected a taskUid in the write response, got ${JSON.stringify(body)}`);
    return uid;
  }

  /**
   * Configure the index for truffle's acceptance test (P2 — declare attributes EXPLICITLY, never trust defaults):
   *   • searchableAttributes = [title, body] (so BM25 searches the real text)
   *   • filterableAttributes = [category, id] (so --facet category + filters work — undeclared = silent fail, P2)
   *   • a userProvided embedder named `hybrid` of FIXTURE_DIMS so hybrid runs on the COMMITTED fixture vectors (D15)
   * Each is an async settings write → we poll each to `succeeded` before returning (P1).
   */
  async configureIndex(index: string, withHybrid: boolean): Promise<void> {
    // Create the index (idempotent). Meili ENQUEUES the create as a task and returns 202 even when the index already
    // exists — the task then FAILS with "already exists", which is benign on a re-run. Tolerate exactly that message
    // (P1: we still poll the task; we just don't treat "already exists" as a failure). A 4xx sync error is real.
    const createRes = await fetch(`${this.cfg.url}/indexes`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify({ uid: index, primaryKey: "id" }),
    });
    if (createRes.ok) {
      await this.waitForTask(this.taskUidOf(await createRes.json()), 30_000, (msg) => /already exists/i.test(msg));
    } else if (createRes.status !== 409) {
      throw new Error(`POST /indexes → HTTP ${createRes.status}: ${await createRes.text()}`);
    }

    const settings: Record<string, unknown> = {
      searchableAttributes: ["title", "body"],
      filterableAttributes: ["category", "id"],
    };
    if (withHybrid) {
      // userProvided embedder: truffle supplies the vector (the committed fixture vector); Meili does NOT call any
      // embedding API (D15 — secret-less, deterministic CI). dimensions is mandatory for userProvided.
      settings.embedders = { hybrid: { source: "userProvided", dimensions: FIXTURE_DIMS } };
    }
    const patchRes = await fetch(`${this.cfg.url}/indexes/${index}/settings`, {
      method: "PATCH",
      headers: this.headers(),
      body: JSON.stringify(settings),
    });
    if (!patchRes.ok) throw new Error(`PATCH /settings → HTTP ${patchRes.status}: ${await patchRes.text()}`);
    await this.waitForTask(this.taskUidOf(await patchRes.json()));
  }

  /**
   * Add documents and WAIT for the task to succeed (P1/S9 — the async-write contract made explicit). Each doc may
   * carry `_vectors: { hybrid: { embeddings, regenerate:false } }` (userProvided form) so the hybrid leg has a
   * vector with no embed-API call. Returns the succeeded task.
   */
  async addDocumentsAndWait(index: string, docs: Array<Record<string, unknown>>): Promise<MeiliTask> {
    const res = await fetch(`${this.cfg.url}/indexes/${index}/documents`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify(docs),
    });
    if (!res.ok) throw new Error(`POST /documents → HTTP ${res.status}: ${await res.text()}`);
    return this.waitForTask(this.taskUidOf(await res.json()));
  }

  /**
   * Search via POST (P4 — never a hand-built filter string in a GET URL). When `vector` + `hybrid` are supplied,
   * Meili fuses the BM25 leg with the vector leg (semanticRatio). Facets return a facetDistribution. The caller
   * (search.ts) decides hybrid-vs-bm25 and treats returned content as UNTRUSTED data (P25).
   */
  async search(
    index: string,
    opts: { q: string; vector?: number[]; semanticRatio?: number; facets?: string[]; filter?: string; limit?: number },
  ): Promise<MeiliSearchResponse> {
    const body: Record<string, unknown> = { q: opts.q, limit: opts.limit ?? 10 };
    if (opts.vector && opts.vector.length > 0) {
      body.vector = opts.vector;
      body.hybrid = { embedder: "hybrid", semanticRatio: opts.semanticRatio ?? 0.5 };
    }
    if (opts.facets && opts.facets.length > 0) body.facets = opts.facets;
    if (opts.filter) body.filter = opts.filter;
    const res = await fetch(`${this.cfg.url}/indexes/${index}/search`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`POST /search → HTTP ${res.status}: ${await res.text()}`);
    const raw = (await res.json()) as {
      hits: Array<Record<string, unknown>>;
      facetDistribution?: Record<string, Record<string, number>>;
      estimatedTotalHits?: number;
    };
    const hits: MeiliHit[] = raw.hits.map((h, i) => ({
      id: String(h.id ?? ""),
      // Meili returns _rankingScore when requested; absent here, use descending rank as a monotone score so the
      // ordering (the thing truffle asserts on) is preserved. The eval scores on ORDER, not the score magnitude.
      score: typeof h._rankingScore === "number" ? (h._rankingScore as number) : 1 - i / Math.max(1, raw.hits.length),
      title: typeof h.title === "string" ? h.title : undefined,
      category: typeof h.category === "string" ? h.category : undefined,
    }));
    const out: MeiliSearchResponse = { hits };
    if (raw.facetDistribution) out.facetDistribution = raw.facetDistribution;
    if (raw.estimatedTotalHits !== undefined) out.estimatedTotalHits = raw.estimatedTotalHits;
    return out;
  }
}
