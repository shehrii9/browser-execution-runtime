# Publishing

This project is MIT-licensed and meant to be wrapped by anyone.

## npm (TypeScript/JS runtime)

```bash
npm test
npm run build
npm publish --access public
```

Package entrypoints:
- CLI: `ber`
- Library: `import { createRuntimeFromEnv, BrowserRuntime } from "browser-execution-runtime"`

Optional env for consumers:
- no LLM required
- `BER_LLM_API_BASE` / `BER_LLM_API_KEY?` / `BER_LLM_MODEL`
- `BER_EMBEDDINGS=hash` to force local embeddings
- `BER_EMBEDDINGS_API_BASE` for neural embeddings

## PyPI (Python client)

```bash
cd sdk/python
python3 -m pip install build
python3 -m build
python3 -m twine upload dist/*
```

Client usage does not need an API key; it talks to the local daemon.

## Chrome debug extension

Not published to Chrome Web Store by default. Load unpacked from `extension/`.

## Notes

- Do not bake provider API keys into the package
- Keep `ber.config.json` local (gitignored)
- Prefer documenting OpenAI-compatible endpoints over vendor lock-in
