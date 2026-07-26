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
- Explicit JSON **action plans**
- Built-in intents: `open <url>`, `search <query> on <site>`
- Semantic page state (buttons/inputs/dialogs/signals)
- State diffs for cheap model context
- Recovery heuristics (cookie/modals/timeouts)
- SQLite **experience memory** (problem → fix + confidence)
- Local HTTP daemon for Hermes tool calls
- Safety policy (domain allowlist, purchase blocking)

## Quick start

```bash
npm install
npx playwright install chromium
npm test
npm run daemon
```

### CLI

```bash
# Observe a page
npm run dev -- observe https://example.com

# Run a plan
npm run dev -- run-plan examples/sample-plan.json

# Built-in intent
npm run dev -- execute "open https://example.com"
```

### Daemon API (Hermes)

```bash
curl -X POST http://127.0.0.1:8787/attach \
  -H 'content-type: application/json' \
  -d '{"startUrl":"https://example.com"}'

curl -X POST http://127.0.0.1:8787/run \
  -H 'content-type: application/json' \
  -d @examples/sample-plan.json
```

For `/run`, wrap the plan:

```json
{ "plan": { "goal": "...", "steps": [] } }
```

See `examples/hermes-tools.json` for tool schemas.

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
  state/              # observe/diff/fingerprint
  selectors/          # a11y/text targeting
  executor/           # actions + plan runner
  recovery/           # problem classification + heuristics
  experience/         # sqlite memory
```

## Env

| Var | Meaning |
|---|---|
| `BER_PORT` | Daemon port (default `8787`) |
| `BER_DATA_DIR` | Data dir for sqlite (default `./data`) |
| `BER_HEADLESS=0` | Show browser |
| `BER_ALLOW_PURCHASE=1` | Allow purchase-like goals/clicks |
| `BER_DOMAINS` | Comma domain allowlist |

## Roadmap

- External planner adapter for Hermes models
- Richer experience similarity (embeddings)
- Multi-tab workflows
- Optional debug extension (attach only)
- Benchmarks vs computer-use token usage
