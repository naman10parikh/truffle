# truffle — LEARNINGS (append-only)

Every error → root cause → rule. Auto-compressed when >500 lines (memory-compress.sh).

## 2026-06-21 · tsc drops the executable bit

- **What broke:** after a clean `pnpm build`, running the `truffle` bin failed with "permission denied".
- **Root cause:** tsc writes new files without the executable bit, shebang or not.
- **Rule:** the build script ends with `chmod +x dist/cli/index.js`. The `prepare` script stays plain `tsc`, because
  npm sets bin modes itself on a git install and a POSIX `chmod` would break installs on Windows.

## 2026-06-22 · Do not exit before async responses flush

- **What broke:** in one-shot pipe mode the MCP server returned nothing for the engine-touching tools.
- **Root cause:** stdin EOF called `process.exit(0)` while the async handler was still awaiting the engine;
  synchronous tools wrote first and hid the race.
- **Rule:** count in-flight requests and exit only when stdin is closed and none are pending.

## 2026-06-22 · Re-indexing must replace, not mix

- **What broke:** a second corpus indexed into the fixture index kept the first corpus's documents, and a BM25-only
  index after a hybrid run failed on stale embeddings.
- **Root cause:** indexing appended instead of replacing, and the user-provided embedder was never reset.
- **Rule:** indexing has replace semantics, and switching off hybrid resets the embedder (`embedders: null`).

## 2026-06-30 · A warm local index hides cold-start failures

- **What broke:** CI acceptance failed on a fresh Meilisearch: "Index `truffle_fixture` not found".
- **Root cause:** Meilisearch v1.28 answers a delete on a missing index with 202 and a task that later fails; the
  code expected a synchronous 404, and the warm local index masked it.
- **Rule:** tolerate "index not found" on the delete step, and prove the acceptance path on a fresh engine, not
  only on a warm local one.

## 2026-10-19 · Resolve package files from the module, not the cwd

- **What broke:** `truffle brain search` and the MCP `truffle_brain_search` tool found nothing when run through
  `npx -y -p github:naman10parikh/truffle`, though they worked inside the repo.
- **Root cause:** `defaultBrainDir()` joined `process.cwd()` with `brain`, so it only worked from the repo root.
- **Rule:** find the package's own files from `import.meta.url`, and prove every bin and MCP tool from an empty
  folder through npx.
