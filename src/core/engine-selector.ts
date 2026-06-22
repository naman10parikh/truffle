// engine-selector.ts — the corpus-size/control decision tree (deterministic, pure code, NOT an LLM call).
//
// Encodes the brain's engine-choice opinions:
//   O11 — answer the corpus-size/control routing question BEFORE naming an engine (search platform ≠ search box).
//   O12 — Meili = the turnkey/agent-native default; Typesense for latency/multitenancy; Postgres = "one fewer service".
//   O13 — NEVER default to Elasticsearch for a product search box; right-size.
//   O15 — NEVER default an agent product to Algolia (per-query + per-record billing is the worst fit for an agent).
//   S13 — the ES-by-default-for-a-small-corpus anti-pattern.
//   S16 — the litmus test: a few-hundred-doc OFFLINE corpus an agent greps → KEEP in-house BM25, do NOT stand up Meili.
// Source: brain/OPINIONS.md O11-O15 · brain/BATTLE-TESTED-SCENARIOS.md S13/S16 · brain/TOOL-MATRIX.md Cat-1.

/** The engines truffle can recommend. `bm25-inhouse` is the deliberate keep-it-simple verdict (S16). */
export type Engine = "bm25-inhouse" | "meilisearch" | "typesense" | "postgres" | "elasticsearch" | "opensearch";

export interface EngineSelectInput {
  /** Document count in the corpus. The PRIMARY routing axis (O11). */
  corpusSize: number;
  /** Multi-tenant product (per-tenant scoped search)? Pushes toward Typesense's HMAC scoped keys (O12). */
  multitenant?: boolean;
  /** Sub-50ms / autocomplete latency requirement? Pushes toward Typesense (raw latency). */
  latencyCritical?: boolean;
  /** Already running Postgres and want "one fewer service"? Pushes toward pgvector (O12). */
  onPostgres?: boolean;
  /** Is this an OFFLINE corpus an agent greps (no server, a few hundred notes)? The S16 litmus. */
  offline?: boolean;
  /** Ops appetite: "low" = managed/turnkey, "high" = can run a cluster. Defaults to "low". */
  opsAppetite?: "low" | "high";
}

export interface EngineSelectResult {
  engine: Engine;
  /** Why this engine — names the routing axis that decided it (O11). Never empty. */
  reason: string;
  /** The honest cost shape (the field average tools hide — O15's per-query billing, ES's ops weight). */
  honestCost: string;
  /** Right-size verdict: is this engine right-sized, over-provisioned, or under-provisioned for the corpus (O13)? */
  rightsizeVerdict: string;
  /** Anti-patterns explicitly rejected for this input (resume-driven ES, Algolia-for-an-agent, …). */
  rejected: string[];
}

/** The S16 litmus: a tiny offline corpus an agent greps → keep BM25, don't reflexively stand up a server. */
const OFFLINE_LITMUS_MAX = 5000;

/**
 * Run the corpus-size/control decision tree. Deterministic: same input → same engine + reason.
 *
 * The tree (O11 — corpus/control FIRST):
 *   1. Offline + tiny  → bm25-inhouse (S16 litmus — do NOT stand up Meili for the brain).
 *   2. Multitenant OR latency-critical → typesense (HMAC scoped keys + raw latency; the B2 contract case).
 *   3. Already on Postgres → postgres+pgvector ("one fewer service", acorn's DB; you hand-roll fusion).
 *   4. Small–mid product box → meilisearch (the turnkey/agent-native default, O12).
 *   5. Petabyte scale + high ops appetite → elasticsearch/opensearch (the ONLY place ES earns its weight, O13).
 * Algolia is NEVER recommended for an agent product (O15) — it's named in `rejected`, not chosen.
 */
export function selectEngine(input: EngineSelectInput): EngineSelectResult {
  const {
    corpusSize,
    multitenant = false,
    latencyCritical = false,
    onPostgres = false,
    offline = false,
    opsAppetite = "low",
  } = input;

  const rejected: string[] = [];
  // Algolia is the standing anti-default for an agent product (O15) — flagged on every decision.
  rejected.push("algolia: per-query AND per-record billing is the worst fit for an agent that queries thousands of times/task (O15)");

  // 1 — the S16 litmus: tiny offline corpus → keep in-house BM25 (the deliberate non-escalation; G14).
  if (offline && corpusSize <= OFFLINE_LITMUS_MAX) {
    return {
      engine: "bm25-inhouse",
      reason: `Corpus is offline and tiny (${corpusSize} docs ≤ ${OFFLINE_LITMUS_MAX}); the S16 litmus says keep the in-house BM25 an agent greps — do NOT stand up a server.`,
      honestCost: "~zero infra: an in-process BM25 index over a few hundred notes; no engine to run, patch, or pay for.",
      rightsizeVerdict: "right-sized: standing up Meilisearch here would be over-engineering (S16).",
      rejected: [...rejected, "meilisearch: standing up a server for a few hundred offline notes is over-provisioning (S16)"],
    };
  }

  // 5 — ES/OpenSearch ONLY at genuine scale + ops appetite (O13 — never ES-by-default; S13 the anti-pattern).
  // Checked before the small/mid default so we never silently fall through to Meili at petabyte scale.
  const PETABYTE_SCALE = 50_000_000;
  if (corpusSize >= PETABYTE_SCALE && opsAppetite === "high") {
    return {
      engine: "opensearch",
      reason: `Corpus is at genuine scale (${corpusSize.toLocaleString()} docs) with high ops appetite — the ONE regime where ES/OpenSearch earns its operational weight (O13).`,
      honestCost: "16-64GB RAM/node, GC pauses, shard/mapping management, the 10K deep-pagination cliff — real ops weight (O13).",
      rightsizeVerdict: "right-sized: at this scale the ES/OpenSearch ops catalog is justified; below it, it is over-provisioned.",
      rejected: [
        ...rejected,
        "elasticsearch-by-default: the resume-driven reflex; only earns its weight at petabyte scale (O13, S13) — chose Apache-2 OpenSearch over AGPL ES, on OPS+COST not license (O14)",
      ],
    };
  }

  // 2 — multitenant or latency-critical → Typesense (the B2 contract case: --corpus-size 500000 --multitenant).
  if (multitenant || latencyCritical) {
    const drivers: string[] = [];
    if (multitenant) drivers.push("multi-tenancy (server-enforced HMAC scoped keys — the cleanest OSS tenant primitive, O12/S7)");
    if (latencyCritical) drivers.push("sub-50ms/autocomplete latency (Typesense's raw-latency edge)");
    return {
      engine: "typesense",
      reason: `Corpus-size/control routing (O11): ${drivers.join(" + ")} dominates at ${corpusSize.toLocaleString()} docs → Typesense.`,
      honestCost: "RAM-bound (the whole index lives in memory) — size RAM to the corpus; no official MCP/CLI (truffle's MCP fills that gap).",
      rightsizeVerdict: "right-sized: Typesense fits a product search box that needs latency and/or tenant isolation without ES's ops weight.",
      rejected: [
        ...rejected,
        "elasticsearch: over-provisioned for a product search box this size — the ES ops catalog isn't earned here (O13)",
      ],
    };
  }

  // 3 — already on Postgres → pgvector ("one fewer service", acorn's DB; you hand-roll RRF fusion, O12).
  if (onPostgres) {
    return {
      engine: "postgres",
      reason: `Already running Postgres at ${corpusSize.toLocaleString()} docs → pgvector keeps it to "one fewer service" (O12); the most agent-legible (SQL) path.`,
      honestCost: "you hand-roll the BM25+vector RRF fusion (two-CTE SQL); needs pgvector ≥ 0.8 + hnsw.iterative_scan for correct filtered-ANN (P17/S4).",
      rightsizeVerdict: "right-sized when the corpus fits Postgres and you value one-fewer-service over turnkey hybrid; this is acorn's box (truffle consumes the connection).",
      rejected,
    };
  }

  // 4 — the default product search box → Meilisearch (turnkey, agent-native, hybrid-on-by-default, O12).
  return {
    engine: "meilisearch",
    reason: `Small–mid product search box (${corpusSize.toLocaleString()} docs), no special latency/tenant/Postgres driver → Meilisearch, the turnkey agent-native default (O12).`,
    honestCost: "self-host or Meili Cloud; index lives largely in RAM; the boring-default that ships fastest (O7).",
    rightsizeVerdict: "right-sized: easiest self-host + best DX + hybrid-on-by-default + official MCP/CLI — the agent-tooling edge (O12).",
    rejected: [
      ...rejected,
      "elasticsearch: right-sizing says NO for a corpus that fits in RAM on one box (O13, S13)",
    ],
  };
}
