---
name: add-reranker
description: Decide whether to ADD or SKIP a reranker, and pick the model. Use when the user asks to "add a reranker", "improve RAG retrieval quality", "should we rerank", or wants better top-k precision. Encodes the discipline — a reranker is the biggest single quality lever, BUT skip it when latency can't absorb +100-500ms (autocomplete) or stage-1 MRR@5 is already > 0.85. Never bolt it onto everything.
brain_source: brain/EXPERTISE-MAP.md JTBD-3 · brain/OPINIONS.md O6/O8/O10 · brain/BATTLE-TESTED-SCENARIOS.md S6 · brain/KNOWN-PITFALLS.md P11/P12
---

# add-reranker

> Encodes JTBD-3 (the reranker half — the highest-leverage quality move after hybrid). A cross-encoder rerank
> of the top-100 is usually the biggest single jump (+5-15 NDCG@10, +20-35% RAG accuracy, 72% LLM-cost
> reduction) — **if you can do ONE thing to a hybrid pipeline, add it** `[O6]`. The expertise is knowing when
> NOT to.

## Trigger

Fire when the request is: "add a reranker", "should we rerank", "improve RAG retrieval quality", "our top-k is
noisy / low precision", or someone proposes **reranking every search surface**. The "rerank everything" pitch
is the S6 trap this skill catches.

## Steps

1. **Decide ADD vs SKIP before picking a model `[O6, S6, P11]`.** Run `truffle rerank advise --mrr <stage1
   MRR@5> --latency-budget <ms> [--surface <name>]`. **SKIP** the reranker when either:
   - **(a) latency can't absorb +100-500ms** (≈100ms on GPU) — e.g. sub-100ms autocomplete; or
   - **(b) stage-1 is already good enough** (bi-encoder MRR@5 > 0.85) — reranking a near-perfect set is pure
     latency cost for no gain.

   **ADD** it where it earns its latency: ambiguous / long-tail / multi-hop queries, precision-critical
   retrieval, and RAG where you pay per retrieved token.

2. **Know the mental model `[EXPERTISE-MAP JTBD-3.4]`.** Embeddings = bi-encoder (encode query & doc
   SEPARATELY, compare by cosine — fast, precomputable, scales to millions). A reranker = cross-encoder (feed
   the FULL (query, doc) PAIR through one model → a single relevance score — far more accurate, CAN'T
   precompute, so run it at query time on a SHORTLIST of top-50–200). Place it as stage-2 in the pipeline:
   hybrid retrieve top-100 → rerank → top-8 `[JTBD-6.2]`.

3. **Pick the model on YOUR corpus, not vendor benchmarks `[O8, P12]`:**
   - **Cohere rerank-3.5** — the easy managed drop-in. Pick it for the **SLA / managed infra**, NOT because it
     wins quality (it's within noise of open bge-large/MonoT5).
   - **bge-reranker-large v2** — if you can **batch on GPU** (matches API latency at zero marginal cost), else
     bge-base.
   - **Voyage rerank** — instruction-following / conversational.
   - **Jina** — open-weight, multimodal.
   - Treat vendor head-to-head numbers as marketing (ZeroEntropy's "+18% vs Cohere" is on ZeroEntropy's OWN
     bench) `[P12]`. In 2026, closed-vs-open is a **compliance/ops decision, not a quality one** `[O10]`.

4. **Eval the choice on a domain golden set `[O8]`.** A reranker swap is a relevance change — gate it behind
   `truffle eval` like any other (`tune-relevance`). Don't pick by leaderboard rank.

## Output format

```
DECISION:      ADD | SKIP
WHY:           <the latency-budget + stage-1 MRR@5 reasoning that drove ADD/SKIP>
SURFACE:       <where it goes (RAG / long-tail) or where it's declined (autocomplete / already-good)>
MODEL:         <Cohere rerank-3.5 (managed SLA) | bge-reranker-large v2 (GPU, zero marginal) | Voyage | Jina>
PLACEMENT:     stage-2 cross-encoder over hybrid top-100 → top-8
GATE:          truffle eval on the domain golden set (NOT vendor benchmarks, NOT MTEB rank)
```

## Worked examples

> **Request A:** "Add a reranker to our product autocomplete to make it more precise."

`truffle rerank advise --mrr 0.88 --latency-budget 80 --surface autocomplete` → **SKIP**. Autocomplete is
sub-100ms; a reranker adds +200-500ms (fatal), and at MRR@5 0.88 stage-1 is already past the 0.85 threshold —
reranking buys nothing `[S6, P11]`.

```
DECISION:      SKIP
WHY:           latency budget 80ms can't absorb +200-500ms; stage-1 MRR@5 0.88 > 0.85 (already good enough)
SURFACE:       declined for autocomplete — pure latency cost for no gain
MODEL:         n/a
GATE:          n/a (no change to gate)
```

> **Request B:** "Our RAG retrieval over support tickets returns noisy chunks — long-tail multi-part questions
> rank badly."

`truffle rerank advise --mrr 0.61 --latency-budget 800 --surface rag` → **ADD**. Long-tail/multi-hop RAG is
exactly where a cross-encoder earns its latency (+20-35% RAG accuracy, 72% LLM-cost reduction); the 800ms budget
absorbs it.

```
DECISION:      ADD
WHY:           long-tail multi-hop RAG; stage-1 MRR@5 0.61 (< 0.85); 800ms budget absorbs +100-500ms
SURFACE:       RAG retrieval over support tickets (precision-critical, paying per retrieved token)
MODEL:         bge-reranker-large v2 on GPU (zero marginal cost) — or Cohere rerank-3.5 if no GPU + want managed SLA
PLACEMENT:     stage-2 cross-encoder over hybrid top-100 → top-8
GATE:          truffle eval on the support-ticket golden set; pick measured on-corpus, not on Cohere's bench
```
