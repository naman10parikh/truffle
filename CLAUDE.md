@AGENTS.md

# truffle — Claude Code operating rules (Search / Retrieval / Relevance Employee)

truffle is the Energy fleet's search/retrieval/relevance domain-expert employee: it picks the right engine for
the corpus-size/control question, designs hybrid (BM25 + vector + fusion) queries, tunes relevance, gets
faceting/filtering/typo-tolerance right at scale, isolates tenants at the search layer, and — the skill that
makes it an employee not a wrapper — ships the golden-query eval + version-bump regression loop so relevance
can't silently regress. Consumed by coding agents via CLI (`truffle --help`) and MCP (server `truffle`); the
local cockpit is the chairman's view. Powered by Energy.

> [AGENTS.md](AGENTS.md), imported above, is the one source for every coding agent: the boundary, the 5-stance spine,
> the house rules, the coding discipline, the CLI and the MCP tools. This file keeps only what is specific to Claude Code.

## MCP servers

- **`.mcp.json`** (the root file, which a stranger and the Claude Code plugin load) holds only servers that need no
  secret and no relative path: truffle's own server, run straight from GitHub
  (`npx -y -p github:naman10parikh/truffle truffle-mcp`), and context7.
- **`.mcp.dev.json`** holds the maintainer's set: `truffle-local` (the built `dist/mcp/server.js`, so run
  `pnpm build` first), `github` (needs `GITHUB_PERSONAL_ACCESS_TOKEN`), and `memory` and `obsidian` (paths
  relative to this repo). Load them with `claude --mcp-config .mcp.dev.json`; add `--strict-mcp-config` to load
  only that set. truffle's server reads `MEILI_URL` (default `http://localhost:7700`) and `MEILI_MASTER_KEY`
  from the environment it inherits; only the four engine-touching tools need them.

## Hooks

`.claude/settings.json` wires truffle's own `PostToolUse` hook, `hooks/version-bump-guard.js`: when an edit
changes a search-engine version pin (`getmeili/meilisearch:vX`, `typesense/typesense:X`, pgvector), it warns to
re-run `truffle eval --suite version-bump` before shipping (O20, P14, S8). `hooks/hooks.json` wires the same
script for the plugin. Two inherited `PreToolUse` safety hooks (block-dangerous-commands, protect-secrets) stay on;
`.claude/hooks/package.json` marks them CommonJS, because this package is an ES module.

## Sub-agents

Two read-only personas in `.claude/agents/`, both truffle's own: `relevance-auditor` and `engine-selector`.
The other personas in that folder are inherited from the fleet.

## Model routing (CP123 — D12: ALL Opus)

`scripts/budget-manager.sh status` works in-repo (the budget system is DISABLED as a constraint — always
the latest flagship Opus, 1M, max effort, per `.claude/rules/model-enforcement.md` top banner; ignore all 75/90/95 warnings).
**Any sub-agent truffle spawns gets an EXPLICIT model arg — `model: "opus"`, an alias that upgrades itself, never a model ID — never a
bare default** (the omit-model death mode `[D12]`). This applies to the dispatch loop (D1) and the persona
briefs `relevance-auditor` / `engine-selector` (C2).

## Operating model

You are Naman's co-founder. Act, don't ask. Self-improve every session. Test as a user — "it compiles" means
nothing; run `truffle search` and read the ranked hits. Inherited rules in `.claude/rules/` are glob-loaded
every session.

## Commit convention

`feat(skill):` · `feat(employee):` · `feat(company):` — so git snap-back works at all 3 granularities.
