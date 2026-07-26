# Browser Execution Runtime

A deterministic **browser execution kernel** for AI agents (built as a Hermes “hands” layer).

Hermes plans. This runtime executes via CDP, keeps compact semantic state, recovers from common failures, and remembers successful fixes so you stop paying computer-use token costs on every step.

```text
Hermes (brain)
   ↓ intent / plan
Browser Execution Runtime
   ↓ CDP actions + recovery + experience memory
Chrome / Chromium
```

## Features (v0.1)

- Attach/launch Chromium through Playwright/CDP
- Explicit JSON **action plans** (transport format only)
- Built-in intents: `open <url>`, `search <query> on <site>`
- Injectable planner boundary for Hermes
- Semantic page state (buttons/inputs/dialogs/signals)
- State diffs for cheap model context
- Recovery heuristics (cookie/modals/timeouts)
- **SQLite experience memory** (not Rust; not “save everything as JSON”)
- L1 in-memory session cache + L2 SQLite experiences
- Resume failed runs + failure screenshots
- Telemetry counters (steps/recoveries/experience hits)
- Computer-use fallback hook (noop unless you inject one)
- Local HTTP daemon for Hermes tool calls
- Safety policy (domain allowlist, purchase blocking)

See [`ARCHITECTURE.md`](./ARCHITECTURE.md) for the decided-vs-shipped matrix and how this relates to the ChatGPT mega-plan.

## Quick start

```bash
npm install
npx playwright install chromium
npm test
npm run daemon
```

### Hermes integration (Phase 1)

```bash
# 1) Start daemon with Hermes as planner (OpenAI-compatible API)
BER_HERMES_API_BASE=http://127.0.0.1:8000/v1 \
BER_HERMES_MODEL=hermes \
npm run daemon

# 2) Export tool schemas into your Hermes agent
npm run dev -- hermes-tools examples/hermes-tools.json

# 3) From Hermes (or CLI bridge), call tools:
npm run dev -- hermes-call browser_attach '{"startUrl":"https://example.com","profile":"persistent"}'
npm run dev -- hermes-call browser_execute '{"intent":"open https://example.com and extract the heading"}'
npm run dev -- hermes-call browser_observe '{}'
```

Hermes should prefer these tools over computer-use. The runtime plans (via Hermes API if configured), executes via CDP, recovers, and stores experiences in SQLite.

### CLI

```bash
# Observe a page
npm run dev -- observe https://example.com

# Run a plan
npm run dev -- run-plan examples/sample-plan.json

# Built-in / Hermes-backed intent
npm run dev -- execute "open https://example.com"
```

### Daemon API

```bash
curl -X POST http://127.0.0.1:8787/attach \
  -H 'content-type: application/json' \
  -d '{"startUrl":"https://example.com","profile":"persistent"}'

curl -X POST http://127.0.0.1:8787/execute \
  -H 'content-type: application/json' \
  -d '{"intent":"open https://example.com"}'
```

For `/run`, wrap the plan:

```json
{ "plan": { "goal": "...", "steps": [] } }
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

Supported actions: `navigate`, `click`, `type`, `select`, `wait`, `scroll`, `extract`, `press`, `dismiss_overlays`, `observe`.

## Memory (important)

- **Not Rust**
- **Not a JSON dump of everything**
- L1: RAM session cache
- L2: `data/experiences.db` (SQLite). Only the fix steps are stored as a JSON column.
- L3: vector similarity — planned, not implemented

## Design principles

1. LLM plans rarely; runtime acts often
2. Send state diffs, not screenshots, by default
3. Remember fixes; replay them with confidence gates
4. Computer-use/vision is fallback, not the hot path

## Project layout

```text
src/
  runtime.ts          # public runtime facade
  api/server.ts       # local daemon
  browser/session.ts  # chrome attach/launch
  planner/            # intent -> plan boundary
  memory/             # L1 session cache
  state/              # observe/diff/fingerprint
  selectors/          # a11y/text targeting
  executor/           # actions + plan runner/scheduler
  recovery/           # problem classification + heuristics
  experience/         # L2 sqlite memory
  telemetry/          # run metrics
```

## Env

| Var | Meaning |
|---|---|
| `BER_PORT` | Daemon port (default `8787`) |
| `BER_DATA_DIR` | Data dir for sqlite (default `./data`) |
| `BER_HEADLESS=0` | Show browser |
| `BER_ALLOW_PURCHASE=1` | Allow purchase-like goals/clicks |
| `BER_DOMAINS` | Comma domain allowlist |
| `BER_HERMES_API_BASE` | OpenAI-compatible planner endpoint |
| `BER_HERMES_API_KEY` | Optional API key |
| `BER_HERMES_MODEL` | Model name (default `hermes`) |
| `BER_URL` | Daemon URL for `hermes-call` |

## Roadmap

- Richer experience similarity (embeddings)
- Multi-tab workflows
- Optional debug extension (attach only)
- Benchmarks vs computer-use token usage
- Wire your live Hermes agent config to these tools
