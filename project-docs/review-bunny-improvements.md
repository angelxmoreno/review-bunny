# review-bunny — Improvement Report

> **Source:** `/Users/angelmoreno/Documents/projects/axm-api/src/scripts/code-review.ts` in `axm-api`
> **Target:** standalone Bun-compiled binary in a new repo called `review-bunny`
> **Date:** 2026-06-12
> **Status:** Pre-fork assessment. All findings sourced from the current script.

This report catalogs every real issue, concern, and improvement opportunity in the existing `code-review.ts` script. The intent is to capture them here so a fresh `review-bunny` repo can be designed with all of them addressed from day one — not as debt to be paid later.

The script is small (~120 lines) and works. Most of the items below are **soft**, not blockers. The "must fix before binary" list is short.

---

## 1. Current behavior summary

The script:

1. Spawns either `ollama launch claude --model <MODEL> ...` or `claude ...` (toggle via `REVIEW_OLLAMA=0` env).
2. Pipes a fixed review prompt to the child process via stdin.
3. Reads the child's stdout as Claude/Anthropic stream-JSON.
4. Renders a 10-frame Braille spinner to stderr.
5. Streams assistant text to stdout, accumulates the full response.
6. Writes `.claude/last-review.md` if the response contains the magic string `ISSUES FOUND`.
7. Exits `1` on issues, `0` on `LGTM`, or the child process's exit code otherwise.

**Default config (after recent edit):** `ollama` with model `kimi-k2.7-code:cloud`. Override via `REVIEW_MODEL=...`. Disable Ollama with `REVIEW_OLLAMA=0`.

---

## 2. Real bugs (must fix before binary)

### 2.1 Silent JSON parse drops

Lines 65-91. The `try { JSON.parse(line) } catch {}` block discards any line that isn't valid JSON. If a tool emits a deprecation warning, a banner, or a partially-garbled chunk mid-stream, it's gone. The user gets no signal that output was lost.

**For a CLI tool run interactively, this is acceptable — stderr would be visible. For a binary run from anywhere (CI, post-commit hooks, scheduled tasks), silent data loss is a real risk.**

**Fix:** route non-JSON lines to stderr, or surface a "N non-JSON lines dropped" warning at the end. At minimum, log to stderr.

### 2.2 No timeout

The script reads stdout until EOF. If the child process hangs (network stall, infinite retry loop, or just a slow reviewer model), the script hangs forever. There's no `Promise.race` against a deadline.

**For a dev tool, you notice and Ctrl-C. For a binary, you want a default timeout (e.g. 5 minutes) and a clear error message on timeout.**

**Fix:** wrap the read loop in a `Promise.race` with a `setTimeout` that sends `proc.kill()` and exits with a timeout error.

### 2.3 Exit-code logic for ambiguous output

```ts
const exitCode = hasIssues ? 1 : fullText.includes('LGTM') ? 0 : (proc.exitCode ?? 0);
```

If the reviewer streams text but uses neither `ISSUES FOUND` nor `LGTM`, exit code falls through to the child process's. For ollama launch wrapping claude, the child exits 0 on success. So an ambiguous response (no magic words) → exit 0 → CI thinks it passed.

**This trusts the prompt to produce the magic words every time. It usually does, but the failure mode is silent.**

**Fix:** decide explicitly: ambiguous = exit 1 (strict) or exit 0 (permissive). Document the choice. Strict is safer for CI gating.

### 2.4 Magic strings inline

`'ISSUES FOUND'`, `'LGTM'`, `'.claude/last-review.md'` are scattered as string literals. If a user wants to use different sentinels (e.g. `PASS`/`FAIL` or `BLOCK`/`OK`), they have to edit source.

**For a binary, these should be CLI flags: `--issue-marker`, `--pass-marker`, `--report-path`.**

---

## 3. Hardening (should fix before binary)

### 3.1 Spinner is not signal-safe

`Ctrl-C` (SIGINT) is not handled. The spinner keeps writing to stderr, the spinner interval is not cleared, and the terminal is left mid-frame. The process exits with the default signal handler.

**Fix:** add a `process.on('SIGINT', () => { stopSpinner(); proc.kill(); process.exit(130); })`.

### 3.2 Spinner writes to pipes

The 12.5 fps spinner writes to stderr. If stderr is not a TTY (CI logs, redirected output), each frame becomes a log line. Harmless but noisy. Modern CLI tools (claude, gemini, gh) check `process.stderr.isTTY` and disable animation otherwise.

**Fix:** guard the spinner with `if (process.stderr.isTTY)`.

### 3.3 `REVIEW_OLLAMA` env semantics are inverted

```ts
const USE_OLLAMA = Bun.env.REVIEW_OLLAMA !== '0';
```

Anything other than literal `'0'` enables Ollama. `REVIEW_OLLAMA=false` enables it. `REVIEW_OLLAMA=claude` enables it. The user can only disable by setting `0` exactly.

**For a binary, use a CLI flag (`--ollama` / `--no-ollama`) and a matching env var (`REVIEW_BUNNY_OLLAMA=1` to enable, absent to use default, `0` to disable). Pick one convention.**

### 3.3a Per-project config: `.rbunnyrc.json` + `.env`

Environment variables are fine for a single user, but a team wants the review command and model choice committed to the repo. **Decision:** support a per-project `.rbunnyrc.json` file (committed to git) for non-secret settings like the model, timeout, and the run command; keep secrets (API keys, tokens) in `.env` (never committed). CLI flags win over `.rbunnyrc.json`, which wins over env vars, which win over built-in defaults.

### 3.4 `Bun.write` and `.claude/last-review.md` path is relative to CWD

The report is written to `.claude/last-review.md` relative to wherever the binary is invoked. This is correct in some workflows, surprising in others. A binary run from `$HOME` would write `.claude/last-review.md` in `$HOME`.

**Fix:** accept `--report-path <path>` and default to `path.join(process.cwd(), '.claude/last-review.md')` — explicit, predictable, overridable.

### 3.5 No `--help` / `--version`

A binary should have `--help` (usage + flags) and `--version`. Neither exists.

**Fix:** use `citty` — it's tiny, tree-shakeable, type-safe, and auto-generates help/usage. Add to runtime deps.

### 3.6 No test coverage

`code-review.ts` has no tests. It's a script that spawns a subprocess and reads a stream — both mockable but the script isn't structured for testability.

**For a binary, you'd want at least:**
- The stream parser tested with fixture stream-JSON inputs.
- The exit-code decision tested with various `fullText` values.
- The env-var/flag resolution tested with overrides.

### 3.7 No `--diff` / `--target` / scope control

The script reviews... whatever the child process reviews by default. It has no way to say "review only staged changes" or "review only files matching `src/**/*.ts`". The prompt and child flags would have to be extended.

**Fix:** add a `--scope` / `--diff` flag that influences the prompt (e.g. "Review only the changes in this diff: <diff>") or the child flags. This is the most common ask for a code-review tool.

### 3.8 No `ollama launch claude` exists in ollama's public docs (verify)

The script runs `ollama launch claude --model ...`. As of late 2025, ollama's `launch` subcommand exists but the `claude` target may not. If ollama's API surface changed, the script breaks silently. **Verify this command path before forking.**

---

## 4. Style / maintainability (nice to fix)

### 4.1 `export {};` on line 1

Required only if other files import this. For a CLI entry point with no importers, drop it.

### 4.2 Section banners (`// --- xxx ---`)

Biome's `useBlockBorders` or similar may flag these. They're visual clutter. Inline comments or a small helper function per concern would be cleaner.

### 4.3 Inline event handler

Lines 71-87 handle three event types inline (`system`, `assistant`, `result`). Extract a `processEvent(event)` function. Easier to test, easier to extend with new event types.

### 4.4 Magic numbers

- Spinner interval: `80` (line 41).
- Default ollama model: `'kimi-k2.7-code:cloud'`.

Pull to named constants at the top of the file.

### 4.5 Use an existing spinner library

Instead of hand-rolling a TTY-guarded spinner and testing it ourselves, use `nanospinner`. It is ~1KB, has no dependencies, auto-detects non-TTY environments, and handles start/stop/error states. This reduces LOC and removes spinner logic from the test surface.

### 4.5 No structured logging

The script uses `console.log` for the "report written" message and `process.stderr.write` for the spinner. A binary that wants `--json` output mode (machine-readable) needs structured logging, not mixed console calls.

**Fix:** introduce a small `output` module with `info(msg)`, `warn(msg)`, `error(msg)` that respects `--json` / `--quiet` flags.

### 4.6 `process.exit` at the end of an async script

`process.exit(exitCode)` at line 123 forces a synchronous exit. If the event loop has pending work (e.g. the `Bun.write` returned but the file handle is still flushing), it can be cut off. Bun's runtime is generally good about this, but the idiomatic approach is to let the process exit naturally (don't call `process.exit` at all) once all async work completes.

**Fix:** remove the explicit `process.exit`, OR if needed, drain pending IO before calling it.

### 4.7 `await proc.exited` after the read loop is redundant

`while (true) { await reader.read() }` exits when stdout closes, which is when the process is exiting. `await proc.exited` is belt-and-suspenders. Keep it for safety, but a comment explaining why would help.

---

## 5. Structural recommendations for the new repo

### 5.1 Split into modules

The current 120-line file does:
- Config resolution (env vars).
- Subprocess spawning.
- Stream-JSON parsing.
- Spinner rendering.
- Report writing.
- Exit-code logic.

For a standalone repo with tests, split into:
- `src/config.ts` — env + flag parsing.
- `src/spawn.ts` — child process construction.
- `src/stream.ts` — stream-JSON event handler (pure, testable).
- `src/spinner.ts` — terminal spinner (TTY-guarded).
- `src/report.ts` — markdown report writer.
- `src/index.ts` — wiring, exit codes.

This is the **factory pattern** from `axm-api/project-docs/conventions.md` applied to a CLI: pure functions per file, filename = export name, `index.ts` is the composition root.

### 5.2 Use a real CLI parser

`bun --bun src/index.ts [args]` is fine, but `citty` or `commander` gives `--help` and `--version` for free, validates flag types, and handles env-var fallback. Pull one in.

### 5.3 Bun.build for binary

The user's stated goal is a Bun-compiled binary that runs from anywhere. `bun build --compile src/index.ts --outfile review-bunny` produces a single-file executable. This is supported on macOS, Linux, and Windows as of Bun 1.1+.

**Caveats for the binary:**
- The embedded Bun runtime adds ~10MB. Acceptable for a dev tool.
- Native modules (none in the current script) need to be recompiled per target. `bun build --compile --target=bun-linux-x64 ...` for cross-compile.
- `Bun.spawn` in a compiled binary spawns the host system's `ollama` or `claude`. The binary doesn't bundle them — they're runtime dependencies. Document this.

### 5.4 Versioning and self-update

A binary installed via `curl | bash` (or `brew install`, or `npm i -g`) needs a version. Add:
- `package.json` `version` field (already standard for Bun).
- `--version` flag.
- Optional: self-update via `bunx review-bunny@latest` pattern (the binary knows the package name and the latest tag).

### 5.5 Repo metadata

For a standalone repo, also need:
- `README.md` — install, usage, flags, examples.
- `LICENSE` — pick one (MIT?).
- `package.json` with `bin: { "review-bunny": "./dist/review-bunny" }` so `npm i -g review-bunny` puts the binary on PATH.
- CI: type check, test, build the binary, attach the binary to releases.
- `CHANGELOG.md` (or rely on `git log` for now).

---

## 6. Out of scope (defer)

These are not in the current script and not required for the binary:

- Web UI / dashboard for review history.
- Multi-file review (currently one prompt, one review).
- Caching reviewer output for unchanged files.
- Async/queue mode for large repos.

All of these would be reasonable future features. None should block the v1 binary.

---

## 7. Open questions for the user

1. **Confirm `ollama launch claude --model kimi-k2.7-code:cloud` works** with current ollama. The `claude` target may have been renamed or removed.
2. **What's the default timeout?** 5 minutes? 10? Configurable?
3. **Ambiguous output = exit 1 or 0?** Strict or permissive?
4. **Should the binary support `--json` output** (machine-readable for CI)? This implies a bigger refactor.
5. **Repo name confirmed as `review-bunny`?** It's cute. No objections, just confirming.
6. **License?** MIT is the standard default for dev tools.
7. **Where does the binary live in PATH?** `/usr/local/bin` via `npm i -g`? Homebrew tap? Manual install?

---

## 8. Bottom line

The current script is **functional but not binary-grade**. Forks: ~5 days of work if you keep scope tight (config module + CLI parser + tests + build pipeline). The current 120 lines grow to maybe 400-500 lines across 6-8 modules, with tests.

The "must fix" list (section 2) is short: silent JSON drops, no timeout, ambiguous exit codes, magic strings as flags. Everything else is polish.
