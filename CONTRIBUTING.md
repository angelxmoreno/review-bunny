# Contributing to review-bunny

Thanks for your interest in contributing!

## Getting started

1. Fork the repository.
2. Clone your fork.
3. Run `bun install` to install dependencies.
4. Run `bun run check` to make sure everything passes locally.

## Development workflow

```bash
bun run dev        # run from source
bun run test       # run tests
bun run build      # compile the binary
bun run lint:fix   # auto-fix formatting and lint issues
bun run check      # full check suite
```

## Commit messages

This repo uses [Conventional Commits](https://www.conventionalcommits.org/). Lefthook runs `commitlint` automatically. Example:

```
feat: add --timeout flag
fix: handle non-JSON stream lines
docs: update README install instructions
```

## Pull request checklist

- [ ] Tests pass: `bun run test`
- [ ] Lint and type checks pass: `bun run check`
- [ ] The binary builds: `bun run build`
- [ ] `README.md` is updated if user-facing behavior changes.
- [ ] `CLAUDE.md` or `project-docs/` are updated if architecture or conventions change.

## Reporting issues

Please open an issue with:
- A clear description of the problem.
- Steps to reproduce.
- Expected vs. actual behavior.
- Environment details: OS, Bun version, and how you installed `review-bunny`.

## Code of conduct

Be respectful, constructive, and inclusive. Assume good intent.
