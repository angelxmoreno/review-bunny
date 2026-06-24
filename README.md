# review-bunny 🐰

> **Archived.** This project is no longer under active development.

We are shelving `review-bunny` in favor of **[DiffScope](https://github.com/evalops/diffscope)**, an actively maintained, Rust-based code review engine that supports OpenAI, Anthropic Claude, Ollama, and any OpenAI-compatible API.

DiffScope covers the same CLI-first, model-agnostic goals `review-bunny` was built for, so we are archiving this repo rather than maintain a parallel implementation.

### npm (global binary)

```bash
npm i -g review-bunny
review-bunny --help
```

### bun

```bash
bun add --global review-bunny
review-bunny --help
```

### From source

```bash
git clone https://github.com/angelxmoreno/review-bunny.git
cd review-bunny
bun install
bun run build
./dist/review-bunny --help
```

## Quick start

```bash
# Review the current branch's working tree
review-bunny

# Review staged changes only
review-bunny --staged

# Review changes against main
review-bunny --target main

# Use a specific model
review-bunny --model kimi-k2.7-code:cloud

# Use the local Claude CLI instead of Ollama
review-bunny --no-ollama

# Save the report somewhere else
review-bunny --report-path ./my-review.md
```

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

### CLI flags

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

### Environment variables

All flags have env-var equivalents with a `REVIEW_BUNNY_*` prefix.

| Env | Equivalent flag |
|---|---|
| `REVIEW_BUNNY_MODEL` | `--model` |
| `REVIEW_BUNNY_OLLAMA=0` | `--no-ollama` |
| `REVIEW_BUNNY_REPORT_PATH` | `--report-path` |
| `REVIEW_BUNNY_TIMEOUT` | `--timeout` |
| `REVIEW_BUNNY_QUIET=1` | `--quiet` |
| `REVIEW_BUNNY_JSON=1` | `--json` |

## Exit codes

| Code | Meaning |
|---|---|
| `0` | Reviewer said LGTM (no issues) |
| `1` | Reviewer found issues (response contains `ISSUES FOUND`) |
| `2` | Error: timeout, subprocess crashed, config invalid |
| `130` | SIGINT (Ctrl-C) |

## Output

```
⠋ Reviewing code...

[streaming text from the reviewer appears here]

📄 Report written to .claude/last-review.md
```

The markdown report contains the full review and is only written when the reviewer flags issues.

## Development

```bash
bun install        # install dependencies
bun run dev        # run from source
bun run test       # run tests
bun run build      # compile the binary to dist/review-bunny
bun run check      # lint, type-check, dead-code, duplicates, health
```

## PR-Agent

This repo uses [PR-Agent](https://github.com/the-pr-agent/pr-agent) for automated pull request reviews, descriptions, and improvement suggestions. It runs as a [GitHub Actions workflow](.github/workflows/pr-agent.yml) and is configured in [`.pr_agent.toml`](./.pr_agent.toml). Reviews are powered by [Ollama Cloud](https://ollama.com/cloud).

- **Default review model:** `kimi-k2.7-code:cloud`
- **Title/description/improvement model:** `gpt-oss:20b-cloud`
- **Fallback model:** `minimax-m3:cloud`

To set it up on your fork:

1. Add your Ollama Cloud API key as a GitHub secret named `OLLAMA_API_KEY` at **Settings → Secrets and variables → Actions**.
2. Open a pull request. PR-Agent will automatically:
   - Generate a title and description
   - Review the changes
   - Suggest improvements

You can also trigger PR-Agent manually by commenting `/review`, `/describe`, or `/improve` on a PR.

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md).

## License

[MIT](./LICENSE)
