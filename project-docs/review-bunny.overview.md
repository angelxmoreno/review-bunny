# review-bunny — Project Overview

> **Codename:** review-bunny
> **Origin:** `/Users/angelmoreno/Documents/projects/axm-api/src/scripts/code-review.ts` in `axm-api`
> **Goal:** A standalone, Bun-compiled binary that runs AI-powered code reviews from anywhere.
> **Status:** Pre-fork. No code yet. Spec only.

---

## What is it?

`review-bunny` is a CLI binary that runs a code review on the current git state of a repository. It spawns an AI reviewer (by default, Claude via the Ollama harness), streams the review to the terminal, and writes a markdown report to disk. Other harnesses and models will be configurable after the MVP.

**In one sentence:** `bunx review-bunny` (or just `review-bunny` if installed) → "Hey, review this code. Stream the verdict to my terminal. Write the long form to a file."

The original implementation lives at `axm-api/src/scripts/code-review.ts` and is ~120 lines of Bun/TypeScript. This overview describes the standalone, hardened, distributable version of that script.

---

## Why fork it?

Three reasons:

1. **Reusability.** The current script is useful for any repo, but it lives inside `axm-api`. Other downstream projects can't `bun run code-review` from their own directories. A binary fixes that.
2. **Distribution.** A `bun --compile` binary is one file, installable via `npm i -g`, Homebrew, or `curl | bash`. No need to clone `axm-api` just to get a code-review script.
3. **Hardening.** The current script has issues that are tolerable for an in-repo dev tool but not for a binary run from CI or scheduled tasks (silent JSON drops, no timeout, ambiguous exit codes). See `review-bunny-improvements.md` for the full list.

---

## What it does

**Input:** A working directory with a git repo. (No args = review the current branch's diff. With `--staged`, review staged changes only. With `--target <ref>`, review changes between refs.)

**Output:**
- **Terminal:** streaming text from the reviewer, with a spinner while waiting.
- **Disk:** `.claude/last-review.md` (default) — markdown report with the full review and a prompt for follow-up agent work.
- **Exit code:** `0` on pass, `1` on issues, `2` on error/timeout.

**Default reviewer:** `ollama launch claude --model kimi-k2.7-code:cloud`. Override with `--model <name>` or `REVIEW_BUNNY_MODEL=<name>`. Disable Ollama with `--no-ollama` to use the local `claude` CLI instead. Other harnesses and providers are out of scope for v0.1 but the config structure should accommodate them later.

---

## User experience

### Install

```bash
# Option A: npm
npm i -g review-bunny

# Option B: Homebrew
brew install review-bunny

# Option C: curl-pipe
curl -fsSL https://review-bunny.dev/install.sh | bash
```

### Run

```bash
# Default: review the current branch's working tree
review-bunny

# Review staged changes only
review-bunny --staged

# Review changes against main
review-bunny --target main

# Use a specific model
review-bunny --model kimi-k2.7-code:cloud

# Use local Claude CLI instead of Ollama
review-bunny --no-ollama

# Save the report somewhere else
review-bunny --report-path ./my-review.md

# JSON output for CI
review-bunny --json
```

### Sample output

```
⠋ Reviewing code...

[streaming text from the reviewer appears here]

📄 Report written to .claude/last-review.md
```

Exit `1` if the reviewer flagged issues; `0` if it said LGTM; `2` on error/timeout.

---

## Architecture

### Module layout

```
src/
  index.ts          Entry point. Parses args, wires modules, sets exit code.
  config.ts         Flag + env-var + .rbunnyrc.json resolution.
  spawn.ts          Constructs and runs the child process (Bun.spawn).
  stream.ts         Pure stream-JSON event parser. Testable in isolation.
  spinner.ts        Uses `nanospinner` instead of custom spinner logic.
  report.ts         Markdown report writer.
  review.ts         Orchestrates: spawn → stream → spinner → report.
```

Each module is a pure function or a small class. `stream.ts` and `config.ts` are the most testable (no I/O). `index.ts` is the composition root.

### Dependencies

**Runtime (in the binary):**
- `citty` — CLI argument parsing.
- `nanospinner` — terminal spinner.
- `zod` — schema validation and type inference.
- No other external runtime deps. Spawns `ollama` or `claude` which the user installs separately.

**Build-time:**
- `typescript`
- `@types/bun`
- `bun-types` for `Bun.build --compile`.

**Test:**
- `bun:test` (built-in).

### Build

```bash
bun build --compile src/index.ts --outfile dist/review-bunny
```

Produces a single-file executable. Cross-compile with `--target=bun-linux-x64` etc.

---

## Configuration

Settings are resolved in this order of precedence: **CLI flags > `.rbunnyrc.json` > environment variables > built-in defaults**. This lets teams share the review command and model choice in git while keeping secrets local.

### `.rbunnyrc.json` (per-project, committed)

Create this file at the project root to share settings across the team:

```json
{
  "model": "kimi-k2.7-code:cloud",
  "ollama": true,
  "reportPath": "./.claude/last-review.md",
  "timeout": 300
}
```

Any flag can be written here in camelCase. The run command (e.g. which model or provider the team uses) belongs in this file so every developer runs the same review setup.

### `.env` (secrets only, not committed)

Put API keys, tokens, and anything machine- or user-specific in `.env`:

```env
REVIEW_BUNNY_MODEL=kimi-k2.7-code:cloud
REVIEW_BUNNY_OLLAMA=1
```

### Flags

| Flag | Default | Description |
|---|---|---|
| `--staged` | off | Review staged git changes only |
| `--target <ref>` | none | Review changes against a git ref (e.g. `main`, `HEAD~1`) |
| `--model <name>` | `kimi-k2.7-code:cloud` | Ollama model name |
| `--no-ollama` | ollama enabled | Use local `claude` CLI instead |
| `--report-path <path>` | `./.claude/last-review.md` | Where to write the markdown report |
| `--timeout <seconds>` | `300` | Kill the reviewer if it doesn't finish in time |
| `--quiet` | off | Suppress the spinner and progress messages |
| `--json` | off | Emit machine-readable output (one JSON object per line) |
| `--help` | — | Show usage |
| `--version` | — | Show version |

### Env vars

All flags have env-var equivalents. `REVIEW_BUNNY_*` prefix.

| Env | Equivalent flag |
|---|---|
| `REVIEW_BUNNY_MODEL` | `--model` |
| `REVIEW_BUNNY_OLLAMA=0` | `--no-ollama` |
| `REVIEW_BUNNY_REPORT_PATH` | `--report-path` |
| `REVIEW_BUNNY_TIMEOUT` | `--timeout` |
| `REVIEW_BUNNY_QUIET=1` | `--quiet` |
| `REVIEW_BUNNY_JSON=1` | `--json` |

Flags win over `.rbunnyrc.json`, which wins over env vars, which win over built-in defaults.

---

## Streaming protocol

The child process (Ollama or Claude CLI) emits Anthropic-style stream-JSON to stdout. Each line is a JSON object with a `type` field:

- `type: "system"` — system event. Ignored.
- `type: "assistant"` with `message.content` — array of content blocks. We extract `block.type === "text"` blocks and stream them.
- `type: "result"` with `result` — final summary (used by some tools, not all).

We accumulate all assistant text into `fullText` for the report.

---

## Exit codes

| Code | Meaning |
|---|---|
| `0` | Reviewer said LGTM (no issues) |
| `1` | Reviewer found issues (response contains `--issue-marker`, default `ISSUES FOUND`) |
| `2` | Error: timeout, subprocess crashed, config invalid |
| `130` | SIGINT (Ctrl-C) |

---

## Testing

Tests live in `tests/`. Module structure:

- `config.test.ts` — flag + env resolution (no I/O).
- `stream.test.ts` — stream-JSON parser with fixture inputs.
- `report.test.ts` — markdown writer with sample reviews.
- `review.test.ts` — full integration with a mock subprocess.

Goal: ≥80% line coverage. Stream parser and config module are the most important (highest complexity, easiest to test).

---

## Open decisions

These will be resolved during v1 development:

1. ~~**Flag parser: `citty` vs `commander` vs hand-rolled.**~~ **Decision:** `citty`.
2. ~~**Spinner: hand-rolled or library.**~~ **Decision:** `nanospinner`.
3. **Output mode: just `--json` or also `--yaml`?** Probably just JSON; defer to v0.2.
4. **Self-update mechanism.** `npm i -g review-bunny@latest`? Or in-binary check? Defer.
5. **CI config.** GitHub Actions for type check + test + binary build + attach to release.
6. **First version:** v0.1.0 — minimum viable binary, core flags, tests for config + stream. No `--json`, no `--quiet` until v0.2.
7. **Repo location:** `github.com/angelxmoreno/review-bunny`.
8. **Default harness:** Ollama `claude` target. Other harnesses are configurable in design but not implemented until after MVP.

---

## Success criteria for v0.1

- [ ] `bun build --compile` produces a working binary.
- [ ] `review-bunny --help` and `--version` work.
- [ ] All flags in the table above are functional.
- [ ] Default invocation (Ollama + `kimi-k2.7-code:cloud`) works end-to-end.
- [ ] Fallback (`--no-ollama` → local `claude` CLI) works.
- [ ] Markdown report is written when issues are found.
- [ ] Exit codes match the spec.
- [ ] Timeout (default 5 min) kills the subprocess cleanly.
- [ ] SIGINT exits cleanly with code `130`.
- [ ] Tests pass: `bun test`.
- [ ] README has install + usage + flags.
- [ ] `npm i -g` from a clean machine works.

---

## Files to create

When forking from `axm-api`:

1. `package.json` — `bin: { "review-bunny": "./dist/review-bunny" }`, scripts: `build`, `dev`, `test`, `lint`, `check`.
2. `tsconfig.json` — ESM, strict, Bun types.
3. `biome.json` — same rules as `axm-api`.
4. `lefthook.yml` + `.commitlintrc.json` — same hooks.
5. `.fallowrc.json` — `entry: ["src/index.ts"]`, `ignoreDependencies: []`.
6. `README.md` — install + usage + flags.
7. `LICENSE` — MIT.
8. `src/` — 7 modules as above.
9. `tests/` — mirror the 4 testable modules.
10. `.github/workflows/release.yml` — build binary, attach to GitHub release.

---

## References

- `review-bunny-improvements.md` — full list of issues and hardening items.
- `axm-api/src/scripts/code-review.ts` — the source we're forking.
- `axm-api/project-docs/conventions.md` — factory pattern we apply to module layout.
