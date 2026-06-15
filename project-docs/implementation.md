# review-bunny — Implementation Plan

This document breaks the work into dependency-ordered phases. Each phase is small enough to be a single commit, builds on the previous phase, and leaves the repo in a working state.

Phases marked **MVP** are required for v0.1.0. Phases marked **Deferred** can ship later.

---

## Phase 0: Project hygiene (done)

**Goal:** Repository is initialized with tooling, docs, and conventions.

- [x] Create `package.json`, `tsconfig.json`, `biome.json`, `lefthook.yml`, `.commitlintrc.json`
- [x] Create `README.md`, `CONTRIBUTING.md`, `LICENSE`, `CLAUDE.md`
- [x] Create project docs: `review-bunny.overview.md`, `review-bunny-improvements.md`, `implementation.md`
- [x] Decide CLI parser (`citty`), spinner (`nanospinner`), config files (`.rbunnyrc.json` + `.env`)
- [x] Pin runtime dependencies: `citty`, `nanospinner`, `zod`
- [x] Add CI workflow: `.github/workflows/ci.yml` (lint, type check, test, build binary)
- [x] First commit prepared

**Commit:** `feat: initial project setup for review-bunny CLI`

---

## Phase 1: Core types and configuration (schema-first)

**Goal:** Define the domain model and a fully resolved configuration object, validated by Zod.

**Why first:** Almost every other module depends on the config shape. Going schema-first gives us runtime validation and inferred TypeScript types from a single source of truth.

**Files:**
- `src/constants.ts` — string constants for runners and providers
- `src/schemas.ts` — Zod schemas and types: `ReviewBunnyConfig`, `ReviewBunnyConfigInput`, runners, providers
- `src/config/loadEnv.ts` — loads and validates `REVIEW_BUNNY_*` env vars
- `src/config/loadRcFile.ts` — loads and validates `.rbunnyrc.json`
- `src/config/resolveConfig.ts` — merges rc + env + CLI overrides and validates
- `src/config/error.ts` — `ReviewBunnyConfigError` for consistent error messages
- `tests/config.test.ts` — unit tests for config resolution and validation errors

**Dependencies added:**
- `zod` — schema validation and type inference

**Decisions to encode:**
- Precedence: CLI flags > `.rbunnyrc.json` > env vars > defaults
- `.rbunnyrc.json` keys are camelCase, env vars use `REVIEW_BUNNY_*` prefix
- Default runner: `claude`, default provider: `ollama`, default model: `kimi-k2.6:cloud`
- Runner/provider combinations are validated (e.g. `claude` supports `ollama` and `anthropic`)
- Validation errors produce clear, user-facing messages (e.g. `.rbunnyrc.json: timeout must be a positive integer`)

**Commit:** `feat: add core types and configuration module with zod schemas`

**Status:** ✅ Complete. All config modules implemented; lint, type check, tests, and full `bun run check` pass.

---

## Phase 2: Stream parser

**Goal:** Parse Anthropic-style stream-JSON lines into a typed stream of events.

**Why now:** The parser is pure logic, easy to test, and needed by the review orchestrator.

**Files:**
- `src/stream.ts` — parse lines into `StreamEvent` union; extract text content
- `tests/stream.test.ts` — fixtures for `system`, `assistant`, `result`, and invalid JSON lines

**Requirements:**
- Handle `system`, `assistant`, and `result` event types
- Accumulate assistant text
- Surface non-JSON lines to stderr or a dropped-line counter
- Be pure: no I/O

**Commit:** `feat: add stream-json parser`

**Status:** Not started.

**Status:** ✅ Complete. `src/stream.ts` and `tests/stream.test.ts` implemented; lint, type check, and tests pass.

---

## Phase 3: Report writer

**Goal:** Write the accumulated review text to a markdown file when issues are found.

**Why now:** Another pure module the orchestrator will call.

**Files:**
- `src/report.ts` — `writeReport(fullText, config)` and `shouldWriteReport(fullText, config)`
- `tests/report.test.ts` — verify report content and conditional write behavior

**Requirements:**
- Write markdown to `--report-path`
- Only write when `fullText` contains the issue marker (default `ISSUES FOUND`)
- Return the written path

**Commit:** `feat: add markdown report writer`

---

## Phase 4: Spinner output

**Goal:** Show progress while waiting for the reviewer.

**Why now:** A tiny module with a single responsibility; used by the orchestrator.

**Files:**
- `src/spinner.ts` — thin wrapper around `nanospinner`; disabled in non-TTY or `--quiet` mode
- `tests/spinner.test.ts` — optional, mock `nanospinner` if needed

**Requirements:**
- Start spinner with message "Reviewing code..."
- Stop on success, error, or cancellation
- Respect `--quiet` and non-TTY environments

**Commit:** `feat: add terminal spinner`

---

## Phase 5: Child process spawn

**Goal:** Spawn `ollama launch claude ...` or `claude ...` and expose a controllable process.

**Why now:** The orchestrator needs this, but it depends on the config shape from Phase 1.

**Files:**
- `src/spawn.ts` — build command args from config; spawn with `Bun.spawn`; expose `stdin`, `stdout`, `kill()`, and `exited`
- `tests/spawn.test.ts` — mock subprocess behavior and command construction

**Requirements:**
- Build correct args for Ollama and fallback Claude CLI
- Accept a prompt via stdin
- Allow timeout/cancellation from caller

**Commit:** `feat: add child process spawner`

---

## Phase 6: Review orchestrator

**Goal:** Wire spawn → stream → spinner → report into one callable function.

**Why now:** This is the core engine. All prior phases feed into it.

**Files:**
- `src/review.ts` — `runReview(config): Promise<ReviewResult>`
- `tests/review.test.ts` — integration tests with a mock child process

**Requirements:**
- Stream stdout lines through the parser
- Update spinner as text arrives
- Accumulate full review text
- Write report if issues found
- Handle timeout (default 300s)
- Handle SIGINT cleanly (exit code 130)
- Return structured result with exit code

**Commit:** `feat: add review orchestrator`

---

## Phase 7: CLI entry point

**Goal:** Parse CLI args with `citty`, load config, run review, and exit with the correct code.

**Why now:** The binary needs a front door.

**Files:**
- `src/index.ts` — replace placeholder; define commands, flags, `--help`, `--version`
- `package.json` — add `citty` and `nanospinner` to dependencies
- `bun.lock` — updated automatically

**Requirements:**
- `--help`, `--version`
- All flags from the spec
- Read `.rbunnyrc.json` and `.env`
- Exit codes: `0` pass, `1` issues, `2` error, `130` SIGINT

**Commit:** `feat: add CLI entry point`

---

## Phase 8: Build, smoke test, and CI

**Goal:** Produce the compiled binary, verify it runs, and add GitHub Actions for CI.

**Files:**
- `dist/review-bunny` — generated binary
- `package.json` — verify `bin` field points to `dist/review-bunny`

**Checks:**
- `bun run build` succeeds
- `./dist/review-bunny --help` works
- `./dist/review-bunny --version` works
- CI workflow already in place from Phase 0 runs green

**Commit:** `build: compile binary and verify CLI`

---

## Phase 9: Final documentation polish

**Goal:** Ensure README and docs match the implemented behavior.

**Files:**
- `README.md` — update any flags/defaults that changed during implementation
- `CLAUDE.md` — update commands or conventions if needed
- `project-docs/implementation.md` — mark phases complete

**Commit:** `docs: finalize readme and project docs`

---

## Deferred work (post-MVP)

These are intentionally out of scope for v0.1.0:

- `--json` output mode
- `--quiet` flag
- Additional harnesses/providers (local Claude CLI support is already included; new ones deferred)
- Self-update mechanism
- Release workflow that attaches binary to GitHub releases
- Plugin/extension system

---

## Dependency graph

```
Phase 0 (tooling/docs/CI)
    │
    ▼
Phase 1 (types + config)
    │
    ├──► Phase 2 (stream parser)
    │
    ├──► Phase 3 (report writer)
    │
    ├──► Phase 4 (spinner)
    │
    └──► Phase 5 (spawn)
              │
              ▼
        Phase 6 (review orchestrator)
              │
              ▼
        Phase 7 (CLI entry point)
              │
              ▼
        Phase 8 (build + smoke test + CI)
              │
              ▼
        Phase 9 (docs polish)
```

Each phase except Phase 0 depends only on completed phases, so the repo stays committable and reviewable at every step.
