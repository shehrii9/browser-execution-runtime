# Browser Execution Runtime

An **open, provider-agnostic browser execution wrapper** for AI agents.

Any agent can wire it up. No vendor lock-in. **No API key required.**

Your agent plans (or you pass an explicit JSON plan). This runtime executes via CDP, keeps compact semantic state, recovers from common failures, and remembers successful fixes so you stop paying computer-use token costs on every step.

```text
Any agent / LLM / script
   ↓ intent or JSON plan
Browser Execution Runtime  (open wrapper)
   ↓ CDP actions + recovery + experience memory
Chrome / Chromium
```

## Why this is open

- Works **without any LLM** (explicit plans + builtin intents)
- Works with **any OpenAI-compatible endpoint** (Ollama, vLLM, LM Studio, OpenAI, Hermes, OpenRouter…)
- **API key is optional** — omit it for local/no-auth providers
- Standard HTTP daemon + OpenAI-style tool schemas anyone can register

See [`INTEGRATING.md`](./INTEGRATING.md) and [`PUBLISHING.md`](./PUBLISHING.md).

## Features

- Attach/launch Chromium through Playwright/CDP
- Explicit JSON action plans
- Builtin intents + optional LLM planner
- Agent tool bridge (`browser_attach/execute/observe/...`)
- Semantic page state + diffs
- Recovery heuristics + site plugins (`cookie`, `auth-modal`, `github`, `google`, `amazon`)
- SQLite experience memory + L3 embeddings (hash default, optional neural)
- Multi-tab actions
- Computer-use fallback cascade (optional)
- Debug Chrome extension bridge (`extension/`)
- Local HTTP daemon
- Safety policy (domain allowlist, purchase blocking)

## Quick start (no API key)

```bash
npm install
npx playwright install chromium
npm test
npm run init-config
npm run doctor
npm run daemon
npm run dev -- run-plan examples/sample-plan.json
```

Python client (optional):

```bash
PYTHONPATH=sdk/python python -c 'from browser_execution_runtime import BrowserRuntimeClient; print(BrowserRuntimeClient().health())'
```

## Wire any agent

```bash
# export tool schemas
npm run dev -- tools examples/agent-tools.json

# call tools against the daemon
npm run dev -- call browser_attach '{"startUrl":"https://example.com"}'
npm run dev -- call browser_run_plan '{"plan":{"goal":"open","steps":[{"action":{"type":"navigate","url":"https://example.com"}}]}}'
```

### Optional local LLM planner (still no key)

```bash
BER_LLM_API_BASE=http://127.0.0.1:11434/v1 \
BER_LLM_MODEL=llama3.2 \
npm run daemon
```

### Optional hosted provider

```bash
BER_LLM_API_BASE=https://api.openai.com/v1 \
BER_LLM_API_KEY=sk-... \
BER_LLM_MODEL=gpt-4.1-mini \
npm run daemon
```

Provider examples: `examples/ber.config.example.json`

## CLI

```bash
npm run dev -- observe https://example.com
npm run dev -- run-plan examples/sample-plan.json
npm run dev -- execute "open https://example.com"
npm run dev -- run-plan examples/multi-tab-plan.json
```

## Daemon API

```bash
curl -X POST http://127.0.0.1:8787/attach \
  -H 'content-type: application/json' \
  -d '{"startUrl":"https://example.com","profile":"persistent"}'

curl -X POST http://127.0.0.1:8787/run \
  -H 'content-type: application/json' \
  -d '{"plan":{"goal":"open","steps":[{"action":{"type":"navigate","url":"https://example.com"}}]}}'
```

## Plan format

```json
{
  "goal": "Open example.com and extract heading",
  "steps": [
    { "action": { "type": "navigate", "url": "https://example.com" } },
    {
      "action": {
        "type": "extract",
        "target": { "role": "heading", "name": "Example Domain" },
        "key": "heading"
      }
    }
  ]
}
```

Supported actions: `navigate`, `click`, `type`, `select`, `wait`, `scroll`, `extract`, `press`, `dismiss_overlays`, `observe`, `new_tab`, `switch_tab`, `close_tab`.

## Memory

- **Not Rust**
- **Not a JSON dump of everything**
- L1: RAM session cache
- L2: `data/experiences.db` (SQLite; fix steps stored as a JSON column)
- L3: local hashing embeddings in SQLite + cosine search

## Design principles

1. Agent plans rarely; runtime acts often
2. Send state diffs, not screenshots, by default
3. Remember fixes; replay them with confidence gates
4. Computer-use/vision is fallback, not the hot path
5. Stay provider-agnostic — wrapper, not a locked SaaS client

## Project layout

```text
src/
  runtime.ts          # public runtime facade
  api/server.ts       # local daemon
  agent/              # tool schemas, HTTP client, bridge
  browser/            # chrome attach/launch + tabs
  planner/            # builtin + generic LLM planner
  memory/             # L1 cache + embeddings
  state/              # observe/diff/fingerprint
  selectors/          # a11y/text targeting
  executor/           # actions + plan runner
  recovery/           # problem classification + heuristics
  experience/         # L2 sqlite memory
  plugins/            # site plugins
  fallback/           # optional computer-use cascade
  telemetry/          # run metrics
```

## Env

| Var | Required | Meaning |
|---|---|---|
| `BER_PORT` | no | Daemon port (default `8787`) |
| `BER_DATA_DIR` | no | Data dir (default `./data`) |
| `BER_HEADLESS=0` | no | Show browser |
| `BER_ALLOW_PURCHASE=1` | no | Allow purchase-like goals/clicks |
| `BER_DOMAINS` | no | Comma domain allowlist |
| `BER_LLM_API_BASE` | no | Any OpenAI-compatible planner endpoint |
| `BER_LLM_API_KEY` | no | Only if provider needs auth |
| `BER_LLM_MODEL` | no | Model name (default `llama3.2`) |
| `BER_EMBEDDINGS_API_BASE` | no | Optional neural embeddings endpoint |
| `BER_EMBEDDINGS_MODEL` | no | Embeddings model id |
| `BER_EMBEDDINGS=hash` | no | Force local hashing embeddings |
| `BER_URL` | no | Daemon URL for `call` |
| `BER_HERMES_*` | no | Legacy aliases |

## Benchmark

```bash
npm run bench:replay
```

## Debug extension

```bash
npm run daemon
# Chrome → chrome://extensions → Load unpacked → ./extension
```

## License

MIT — open for anyone to wrap, fork, and integrate.
