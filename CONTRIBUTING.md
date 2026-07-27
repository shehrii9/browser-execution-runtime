# Contributing to Browser Execution Runtime

Thanks for your interest in this project. Contributions of all sizes are welcome — bug fixes, docs, site plugins, tests, and design discussion.

## Before you start

1. Search [existing issues](https://github.com/shehrii9/browser-execution-runtime/issues) to avoid duplicate work.
2. For larger changes, open an issue first so we can align on approach.
3. Read [`ARCHITECTURE.md`](./ARCHITECTURE.md) for design boundaries (execution kernel vs planner, SQLite memory model, etc.).

## Good places to help

| Area | Why it matters | Starting points |
|------|----------------|-----------------|
| **Site plugins** | Real sites break in predictable ways | [`src/plugins/`](./src/plugins/), add a host under an existing plugin or a new small plugin |
| **Recovery & modals** | Cookie/login/OTP flows are never “done” | [`src/recovery/`](./src/recovery/), [`src/state/`](./src/state/) |
| **Examples & integrations** | Lowers the bar for new agents | [`examples/`](./examples/), [`INTEGRATING.md`](./INTEGRATING.md) |
| **Python SDK** | Parity with the daemon API | [`sdk/python/`](./sdk/python/) |
| **Tests** | Unit tests run without a browser; browser smoke needs Chromium | `npm test`, `npm run test:browser` |
| **Rust core (experimental)** | Fingerprints / embeddings CLI | [`crates/ber-core/`](./crates/ber-core/) |
| **Docs** | README is long; gaps live in ARCHITECTURE | [`ARCHITECTURE.md`](./ARCHITECTURE.md), inline code comments |

Ideas that fit the project but are not started yet (see architecture notes): richer dynamic-page signaling (e.g. push-style DOM change hints), more media/content hosts, and hardening iframe/shadow edge cases.

## Development setup

Requirements: Node.js 20+, npm, Chromium (via Playwright).

```bash
git clone https://github.com/shehrii9/browser-execution-runtime.git
cd browser-execution-runtime
npm install
npx playwright install chromium
```

Verify your change:

```bash
npm run typecheck
npm test
npm run test:browser   # needs Chromium; slower
npm run build
```

Rust (optional):

```bash
cargo test -p ber-core
```

## Pull request guidelines

Open PRs against `main` and wait for the **`all`** CI check (or **test** + **rust**). See [`docs/BRANCH_PROTECTION.md`](./docs/BRANCH_PROTECTION.md) if GitHub does not list checks yet.

- **Scope**: One logical change per PR when possible.
- **Tests**: Add or update tests when behavior changes. Prefer unit tests; use browser tests for CDP/Playwright behavior.
- **Style**: Match surrounding TypeScript (no drive-by refactors).
- **Commits**: Clear messages; squash is fine on merge.
- **Changelog**: User-facing changes can be noted in the PR description; releases follow [`PUBLISHING.md`](./PUBLISHING.md).

## Code of conduct

This project follows the [Contributor Covenant](./CODE_OF_CONDUCT.md). Please read it before participating.

## Questions

Open a [GitHub Discussion](https://github.com/shehrii9/browser-execution-runtime/discussions) (Q&A) or an issue. FAQ draft for moderators: [`docs/DISCUSSIONS_FAQ.md`](./docs/DISCUSSIONS_FAQ.md).

## Roadmap and starter tasks

- [`ROADMAP.md`](./ROADMAP.md) — priorities and deferred scope
- [`GOOD_FIRST_ISSUES.md`](./GOOD_FIRST_ISSUES.md) — curated tasks (linked to GitHub labels)
- [`docs/COMPARISON.md`](./docs/COMPARISON.md) — BER vs computer-use loops
