# truffle — BRAND

## Name rationale

**truffle** — locked for the search vertical. A truffle is the rare, prized thing you *find*, and you don't
find it by digging randomly — you bring a **trained nose**. The metaphor is load-bearing for this domain:
search is not "store everything," it's the **trained retrieval of the one right result** from a noisy corpus,
and the nose (relevance) is a skill that is *never finished being trained* ("search is never done; good search
looks effortless and is the most expensive feature to maintain" — `brain/OPINIONS.md` O19). It fits the
Energy light/relatable/animate naming family (Spark/Ribbon vibes).

## Tagline

> **truffle — the search employee. Typo-tolerant, faceted, relevance-ranked hybrid search that you can prove.
> Powered by Energy.**

## Colors & type (Energy design system — `.claude/rules/design.md`)

- **Background:** warm black `#141312` (NOT pure black `#000`, NOT near-black `#09090b`).
- **Accent:** amber (the Energy editorial accent). **No AI-purple / generic indigo gradients** — that exact
  indigo is the apologized-for AI-slop prior; truffle's palette is intentionally warm, editorial, grounded.
- **Display / headings:** Instrument Serif.
- **Body:** Poppins.
- The serif + sans-serif pairing is the single highest-impact anti-AI-generated-look choice. Asymmetric bento
  layouts over symmetric card grids.

## Landing copy (the human-facing intro)

> I'm truffle, the search employee. Point me at some documents and I'll stand up a search box that tolerates
> typos, lets people filter by facets, and ranks the *right* results to the top — using both keyword and
> meaning together, not just one. Then I prove it works with a test set, and I keep that test set so a "fix"
> for one query can't quietly break a thousand others. I tell you exactly what I'm assuming and where the
> experts still disagree. I don't run your database — I run the search on top of it.

**To a coding agent (machine-first):**

> `truffle` · search employee · Meilisearch (default) / Typesense / Postgres+pgvector / Algolia / ES /
> OpenSearch · hybrid (BM25+vector) + rerank + faceting + typo-tolerance + relevance-eval. Drive me via CLI
> (`truffle --help`) or MCP (server `truffle`, tools `truffle_index` / `truffle_search` /
> `truffle_engine_select` / `truffle_eval` / …). I return the right ordered hits + a relevance proof; I do
> **NOT** own your pgvector DB (that's acorn) or your LLM answer step (downstream). Brain at `brain/`
> (BM25-searchable via `truffle brain search`).
