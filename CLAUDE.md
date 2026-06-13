# review-bunny — Claude Code project guide

## What this project is

`review-bunny` is a standalone, Bun-compiled CLI binary for AI-powered code reviews. It is the hardened, distributable version of the original `code-review.ts` script from `axm-api`.

**One-sentence goal:** `review-bunny` reads the current git state, asks an AI reviewer (Claude via Anthropic or Ollama) for feedback, streams the verdict to the terminal, and writes the full report to disk.

## Tech stack

- **Runtime:** Bun 1.1+
- **Language:** TypeScript (ES modules)
- **CLI parsing:** `citty` — small, tree-shakeable, type-safe, and Bun-friendly. Auto-generates help/usage and validates typed args.
- **Build:** `bun build --compile src/index.ts --outfile dist/review-bunny`
- **Tests:** `bun:test`
- **Lint/format:** Biome
- **Git hooks:** Lefthook + commitlint (conventional commits)
- **Dependency analysis:** Fallow

## Module layout

Follow the factory pattern: one concern per file, filename = export name.

```
src/
  index.ts          Entry point. Parses args, wires modules, sets exit code.
  config.ts         Flag + env-var + .rbunnyrc.json resolution.
  spawn.ts          Constructs the child process command.
  stream.ts         Pure stream-JSON event parser.
  spinner.ts        TTY-guarded terminal spinner.
  report.ts         Markdown report writer.
  review.ts         Orchestrates: spawn → stream → spinner → report.
```

Keep `index.ts` as the composition root. Make `config.ts`, `stream.ts`, and `report.ts` as pure and testable as possible.

## Configuration decisions

- **Per-project config:** `.rbunnyrc.json` at the repo root. Committed to git. Use camelCase for flag names.
- **Secrets / user-specific values:** `.env`. Never committed.
- **Precedence:** CLI flags > `.rbunnyrc.json` > environment variables > built-in defaults.
- **Shared run command:** The model/provider choice belongs in `.rbunnyrc.json` so the whole team runs the same review setup.

## Key commands

```bash
bun run dev        # run from source
bun run build      # compile the binary
bun run test       # run tests
bun run test:coverage
bun run lint       # check formatting/lint
bun run lint:fix   # auto-fix formatting/lint
bun run check:types
bun run check      # full check suite
```

## Build constraints

- The binary is produced with `bun build --compile`.
- `Bun.spawn` is used to call the host's `ollama` or `claude` CLI; those are runtime dependencies, not bundled.
- No native modules unless absolutely necessary.

## Code style

- Follow the Biome rules in `biome.json`.
- Use single quotes, semicolons, and 4-space indentation.
- Prefer pure functions and small modules over inline logic.
- Keep magic strings (sentinels, default paths) in `config.ts` or as constants.

## When changing behavior

- Update `README.md` if user-facing flags or config change.
- Update `project-docs/` if the change affects the architecture or open decisions.
- Add or update tests in `tests/` for `config.ts`, `stream.ts`, and `report.ts` at minimum.
