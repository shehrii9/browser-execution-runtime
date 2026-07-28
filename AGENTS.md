# AGENTS.md

## Cursor Cloud specific instructions

Browser Execution Runtime (BER): a local, provider-agnostic CDP browser control kernel. Two codebases live here — a Node/TypeScript runtime + HTTP daemon (`src/`, entry `src/cli.ts`) and an experimental Rust core (`crates/ber-core`). No API key is required for BER itself.

The startup update script already runs `npm ci` and installs the Playwright Chromium browser, so dependencies and the browser binary are ready. Standard scripts are defined in `package.json` and the run/API commands are documented in `README.md` — reference those rather than duplicating.

Non-obvious caveats:

- `npm run test:browser` finds **no test files** because `vitest.config.ts` `exclude`s `tests/browser-smoke.test.ts` and that exclude is not overridden by the CLI positional filter (or by appending `--exclude ''`). The smoke tests themselves pass. To actually run them, use a config whose `include` is only that file, e.g. create a throwaway `vitest.<name>.config.ts` in the repo root (module resolution requires it to live under `/workspace`, not `/tmp`) with `include: ["tests/browser-smoke.test.ts"]` and run `npx vitest run --config <that-file>`, then delete it. Browser smoke tests require outbound internet (they hit `https://example.com`).
- The daemon listens on `http://127.0.0.1:8787` and runs headless by default. Start it with `npm run daemon` (dev, via tsx) or `npm start` (setup + daemon). Run long-lived processes like the daemon in a tmux session so they outlive a single command.
- `npm start` / `npm run setup` runs `scripts/setup.mjs`, which copies `examples/ber.config.example.json` to `ber.config.json` and creates `data/`. Both `ber.config.json` and `data/` are gitignored, so they never show up in `git status`.
- Quick end-to-end sanity check once the daemon is up: `curl -s http://127.0.0.1:8787/health` then POST `examples/sample-plan.json` to `/run` — a successful run returns `"ok": true` with `extracted.heading == "Example Domain"`.
- The Rust core is a separate workspace: `cargo test -p ber-core` and `cargo build -p ber-core [--release]`. It is independent of the Node runtime.
