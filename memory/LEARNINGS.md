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
