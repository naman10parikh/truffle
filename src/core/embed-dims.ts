// embed-dims.ts — embedder shortlist + the dims-vs-index-cap check (deterministic, pure code).
//
// Encodes O8/O9 + S14: never pick an embedder by MTEB rank alone (MTEB is a PRIOR, not an oracle — your 200-query
// golden set decides), and never assume the biggest model is usable — pgvector HNSW caps at 2,000 dims (4,000 for
// halfvec), so OpenAI 3-large at 3,072 CANNOT be ANN-indexed unless you Matryoshka-truncate. Dims drive the
// vector-DB bill far more than the embedding-API bill. Source: brain/OPINIONS.md O7/O8/O9 · BATTLE-TESTED S11/S14.

/** A shortlisted embedder candidate (the boring defaults first, per O7). */
export interface EmbedderCandidate {
  model: string;
  /** Native output dimensionality. */
  dims: number;
  /** Does the model support Matryoshka dimension truncation (slice the vector, keep most quality)? */
  matryoshka: boolean;
  note: string;
}

export type IndexCap = 2000 | 4000;

export interface EmbedAdviseInput {
  /** The pgvector HNSW index cap: 2000 (float32) or 4000 (halfvec). Defaults to 2000 (the float32 default). */
  indexCap?: IndexCap;
  /** Does the use case need a long-context embedder (large chunks)? Shifts the shortlist. */
  longContext?: boolean;
  /** Optional corpus path (for the message only — the eval is on the caller's golden set, never auto-run). */
  corpus?: string;
}

export interface EmbedAdvice {
  /** Boring-default-first shortlist to EVAL on a golden set (never to pick #1 off MTEB). */
  shortlist: EmbedderCandidate[];
  /** The dims-vs-index-cap warning + Matryoshka/halfvec prescription (S14). */
  dimsNote: string;
  /** ALWAYS true — the load-bearing rule: MTEB shortlists, YOUR golden set decides (O8). */
  goldenSetRequired: true;
  /** Candidates whose native dims EXCEED the index cap and so need truncation/halfvec before they're indexable. */
  overCap: string[];
}

// The boring-default shortlist (O7 — start here, MEASURE, don't fine-tune first). Dims are the load-bearing axis.
const DEFAULT_SHORTLIST: EmbedderCandidate[] = [
  { model: "openai/text-embedding-3-small", dims: 1536, matryoshka: true, note: "the boring default (O7); Matryoshka-truncatable to 512/256; cheapest lift before fusion+rerank" },
  { model: "BAAI/bge-large-en-v1.5", dims: 1024, matryoshka: false, note: "open default; matches closed on retrieval quality (O10); zero marginal cost on a GPU" },
  { model: "openai/text-embedding-3-large", dims: 3072, matryoshka: true, note: "higher quality BUT 3072 dims EXCEEDS the pgvector HNSW float32 cap — must Matryoshka-truncate or use halfvec (S14)" },
];

const LONG_CONTEXT_SHORTLIST: EmbedderCandidate[] = [
  { model: "jinaai/jina-embeddings-v3", dims: 1024, matryoshka: true, note: "long-context (8k) open model; Matryoshka-truncatable; strong on long chunks" },
  { model: "openai/text-embedding-3-small", dims: 1536, matryoshka: true, note: "the boring default (O7); 8k context; truncatable" },
  { model: "BAAI/bge-m3", dims: 1024, matryoshka: false, note: "long-context multilingual open model; dense+sparse+multi-vector" },
];

/**
 * Shortlist embedders + flag the dims-vs-index-cap problem for the chosen pgvector cap. Deterministic.
 * NEVER auto-runs an eval or calls an embedding API — it returns the shortlist + the rule that the caller MUST
 * eval on their own golden set (O8). The `overCap` list names every candidate that can't be HNSW-indexed as-is.
 */
export function adviseEmbedder(input: EmbedAdviseInput = {}): EmbedAdvice {
  const { indexCap = 2000, longContext = false } = input;
  const shortlist = longContext ? LONG_CONTEXT_SHORTLIST : DEFAULT_SHORTLIST;

  const overCap = shortlist.filter((c) => c.dims > indexCap).map((c) => c.model);

  const dimsNote =
    overCap.length > 0
      ? `Index cap is ${indexCap} dims (${indexCap === 2000 ? "pgvector HNSW float32" : "pgvector HNSW halfvec"}). ` +
        `OVER CAP and NOT ANN-indexable as-is: ${overCap.join(", ")}. ` +
        `Fix: Matryoshka-truncate to ≤ ${indexCap} dims (these models keep most quality when sliced) OR switch to halfvec (4000-dim cap). ` +
        `Remember: dims drive the vector-DB bill (1024-dim float32 = 4KB/vector → 10M docs = 40GB) far more than the embedding-API bill (O9, S14).`
      : `All shortlisted models fit the ${indexCap}-dim ${indexCap === 2000 ? "float32" : "halfvec"} HNSW cap — directly ANN-indexable. Still pick dims for indexability AND cost, not just quality (O9).`;

  return { shortlist, dimsNote, goldenSetRequired: true, overCap };
}
