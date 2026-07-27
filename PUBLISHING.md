# Publishing

This project is MIT-licensed and meant to be wrapped by anyone.

Repo: https://github.com/shehrii9/browser-execution-runtime

## Preflight checklist

```bash
npm test
npm run typecheck
npm run build
npm run pack:check
cargo test -p ber-core   # Rust core
npm run doctor
```

Confirm `npm pack --dry-run` includes `dist/`, `examples/`, `scripts/`, `sdk/python/`, and docs — not `node_modules/` or `data/`.

## Release notes

When tagging a release, copy [`.github/RELEASE_NOTES_TEMPLATE.md`](./.github/RELEASE_NOTES_TEMPLATE.md) into the GitHub Release description.

After the first npm publish, add this badge to the README:

```markdown
[![npm version](https://img.shields.io/npm/v/browser-execution-runtime.svg)](https://www.npmjs.com/package/browser-execution-runtime)
```

## Automated release (recommended)

1. Add GitHub repo secrets:
   - `NPM_TOKEN` — npm access token (Automation or Publish)
   - `PYPI_TOKEN` — optional PyPI API token
2. Bump versions in `package.json` + `sdk/python/pyproject.toml` + `Cargo.toml` workspace
3. Commit, push to `main`
4. Tag and push:

```bash
git tag v0.2.0
git push origin v0.2.0
```

The `Release` workflow then:
- publishes the npm package
- uploads the Python client if `PYPI_TOKEN` is set
- builds and attaches the `ber-core` Rust binary artifact

## Manual npm publish

```bash
npm test
npm run build
npm login
npm publish --access public
```

Package entrypoints:
- CLI: `ber` / `npx browser-execution-runtime` (after publish) or `npm start` in the repo
- Library: `import { createRuntimeFromEnv, BrowserRuntime } from "browser-execution-runtime"`

Optional env for consumers:
- no LLM required
- `BER_LLM_API_BASE` / `BER_LLM_API_KEY?` / `BER_LLM_MODEL`
- `BER_EMBEDDINGS=hash` to force local embeddings
- `BER_EMBEDDINGS_API_BASE` for neural embeddings
- `BER_PIERCE_SHADOW=0` to disable CDP closed-shadow pierce during observe
- `BER_RUST_CORE=1` to prefer the experimental `ber-core` binary for fingerprints

## Manual PyPI publish

```bash
cd sdk/python
python3 -m pip install build twine
python3 -m build
python3 -m twine upload dist/*
```

Client usage does not need an API key; it talks to the local daemon.

## Rust core binary

```bash
cargo build -p ber-core --release
./target/release/ber-core --help
```

## Chrome debug extension

Not published to Chrome Web Store by default. Load unpacked from `extension/`.

## Notes

- Do not bake provider API keys into the package
- Keep `ber.config.json` local (gitignored)
- Prefer documenting OpenAI-compatible endpoints over vendor lock-in
- Native module `better-sqlite3` requires a Node rebuild on install for consumers
- This environment may not be logged into npm/PyPI — use the Release workflow secrets instead
