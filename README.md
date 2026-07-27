# Browser Execution Runtime

**Open, provider-agnostic browser execution kernel for AI agents.**

Any agent can wrap it. No vendor lock-in. **No API key required.**

[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](./LICENSE)
[![Node.js](https://img.shields.io/badge/node-%3E%3D20-brightgreen.svg)](./package.json)
[![TypeScript](https://img.shields.io/badge/TypeScript-5+-blue.svg)](./tsconfig.json)

This runtime sits between your agent and Chromium:

```text
Your agent / LLM / script
        │
        │  intent  or  JSON plan
        ▼
Browser Execution Runtime
  • semantic state + diffs
  • recovery + site plugins
  • experience memory
  • optional LLM planner
        │
        │  CDP
        ▼
   Chrome / Chromium
```

Your model plans rarely. The runtime executes often — so you stop paying computer-use / vision tokens on every click.

---

## Why this exists

Most “AI browser” setups either:

1. re-send screenshots to a model on every step (slow + expensive), or  
2. lock you into one vendor SDK / API key.

This project is a **local execution wrapper**:

| You bring | This runtime provides |
|---|---|
| Any agent (OpenAI tools, Hermes, custom scripts, Python…) | CDP browser control |
| Optional OpenAI-compatible LLM | Plan execution + recovery |
| Explicit JSON plans (no LLM at all) | Semantic state, diffs, memory |

---

## Features

- **CDP browser control** — launch, attach, persistent profile, multi-tab
- **Deterministic plans** — `navigate`, `click`, `type`, `wait`, `extract`, …
- **Semantic page state** — roles/text/signals instead of raw HTML dumps
- **State diffs** — cheap context for agents
- **Self-healing recovery** — cookie banners, overlays, retries
- **Experience memory** — SQLite store of problem → fix (+ confidence)
- **L3 similarity** — local hashing embeddings by default; optional neural `/embeddings`
- **Site plugins** — `cookie-consent`, `auth-modal`, `github`, `google`, `amazon`, `media-sites`
- **Dynamic settle** — waits for SPA/DOM quiet after navigate/click; `wait.settle`
- **Infinite scroll** — `scroll` with `untilText` / `untilCss` / `untilCountAtLeast`
- **Media actions** — `media` play/pause/mute/skip_ad for video/audio sites
- **Event bus** — step/recovery/run events via `GET /events` or SSE stream
- **Iframe targets** — `frame` / `frameUrl` for consent CMPs and nested UI
- **Open tool bridge** — OpenAI-style `browser_*` tools any agent can register
- **Optional LLM planner** — any OpenAI-compatible endpoint; key optional
- **Debug Chrome extension** — attach-only bridge (no AI inside)
- **Safety policy** — domain allowlist, purchase blocking
- **One-command start** — `npm start` (setup + daemon)

---

## Requirements

- Node.js **20+**
- npm
- Chromium (via Playwright install)

---

## Quick start

One command (installs Chromium if needed, writes config once, starts the daemon):

```bash
npm install
npm start
```

That is all for first startup. The engine listens on `http://127.0.0.1:8787`.

In another terminal:

```bash
# run an explicit plan (no LLM needed)
npm run dev -- run-plan examples/sample-plan.json

# or call the daemon
curl -s http://127.0.0.1:8787/health
bash examples/integrations/curl-demo.sh
```

Setup only (no daemon):

```bash
npm run setup
```

### Python client

```bash
# daemon must already be running
PYTHONPATH=sdk/python python3 - <<'PY'
from browser_execution_runtime import BrowserRuntimeClient
client = BrowserRuntimeClient()
print(client.health())
client.attach(start_url="https://example.com")
print(client.run({
    "goal": "open example",
    "steps": [{"action": {"type": "navigate", "url": "https://example.com"}}],
}))
PY
```

---

## Three ways to use it

### 1) Runtime-only (zero LLM)

Best default. Your agent/script sends JSON plans.

```bash
npm run daemon
npm run dev -- run-plan examples/sample-plan.json
```

### 2) Local open model (usually no API key)

```bash
BER_LLM_API_BASE=http://127.0.0.1:11434/v1 \
BER_LLM_MODEL=llama3.2 \
npm run daemon
```

Works with Ollama, vLLM, LM Studio, and other OpenAI-compatible servers.

### 3) Hosted provider

```bash
BER_LLM_API_BASE=https://api.openai.com/v1 \
BER_LLM_API_KEY=sk-... \
BER_LLM_MODEL=gpt-4.1-mini \
npm run daemon
```

Keys are only needed if *your provider* requires them. This runtime never requires a key by itself.

More provider examples: [`examples/ber.config.example.json`](./examples/ber.config.example.json)  
Full integration guide: [`INTEGRATING.md`](./INTEGRATING.md)

---

## Wire any agent (Cursor, Codex, Claude, custom…)

```bash
npm run daemon
npm run tools -- examples/agent-tools.json
```

### Cursor

- Repo rule: [`.cursor/rules/ber-runtime.mdc`](./.cursor/rules/ber-runtime.mdc)
- Copy/paste snippet: [`examples/integrations/cursor-rules.md`](./examples/integrations/cursor-rules.md)

### OpenAI Codex

- Prompt template: [`examples/integrations/codex-prompt.md`](./examples/integrations/codex-prompt.md)

### Generic OpenAI-style tools

```bash
node examples/integrations/openai-tools.mjs
```

Register the exported tools in your agent, then prefer them over computer-use:

| Tool | Purpose |
|---|---|
| `browser_attach` | Launch/attach browser |
| `browser_execute` | High-level intent → plan → run |
| `browser_run_plan` | Execute explicit JSON plan |
| `browser_observe` | Compact semantic state |
| `browser_diff` | What changed |
| `browser_resume` | Resume last failed run |
| `browser_status` | Runtime + memory status |
| `browser_tabs` | List tabs |
| `browser_events` | Recent step/recovery/run events |

JS example:

```bash
node examples/integrations/openai-tools.mjs
```

CLI bridge:

```bash
npm run dev -- call browser_attach '{"startUrl":"https://example.com"}'
npm run dev -- call browser_observe '{}'
```

---

## CLI

```bash
npm start                      # ONE command: setup + start daemon (:8787)
npm run setup                  # setup only (no daemon)
npm run daemon                 # daemon only (after setup)
npm run doctor                 # show resolved config / planner mode
npm run init-config            # write ber.config.json
npm run tools                  # print OpenAI-style tool schemas
npm run bench:replay           # cookie-banner replay benchmark

npm run dev -- observe https://example.com
npm run dev -- execute "open https://example.com"
npm run dev -- run-plan examples/sample-plan.json
npm run dev -- run-plan examples/multi-tab-plan.json
npm run dev -- run-plan examples/media-search-plan.json
npm run dev -- run-plan examples/media-watch-plan.json
npm run dev -- run-plan examples/scroll-until-plan.json
npm run dev -- call <tool> '<json>'
```

After `npm run build`, the `ber` binary is available via `node dist/cli.js` / package bin.

---

## Daemon API

Base URL: `http://127.0.0.1:8787`

| Method | Path | Description |
|---|---|---|
| `GET` | `/health` | Liveness |
| `GET` | `/status` | Runtime + memory status |
| `GET` | `/observe` | Semantic state |
| `GET` | `/diff` | State diff |
| `GET` | `/tabs` | Open tabs |
| `GET` | `/plugins` | Loaded plugins |
| `GET` | `/experiences` | Stored experiences |
| `GET` | `/metrics` | Run metrics |
| `GET` | `/events` | Recent runtime events (`afterId`, `limit`, `type`) |
| `GET` | `/events/stream` | Server-Sent Events stream of runtime events |
| `GET` | `/extension/info` | Debug extension metadata |
| `POST` | `/attach` | Launch/attach browser |
| `POST` | `/run` | Execute plan |
| `POST` | `/execute` | Intent → plan → run |
| `POST` | `/act` | Single action |
| `POST` | `/resume` | Resume failed plan |
| `POST` | `/policy` | Update safety policy |
| `POST` | `/remember` | Store experience |
| `POST` | `/tabs/new` `/tabs/switch` `/tabs/close` | Tab controls |

Attach example:

```bash
curl -X POST http://127.0.0.1:8787/attach \
  -H 'content-type: application/json' \
  -d '{"startUrl":"https://example.com","profile":"persistent"}'
```

Run example:

```bash
curl -X POST http://127.0.0.1:8787/run \
  -H 'content-type: application/json' \
  -d @- <<'EOF'
{
  "plan": {
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
}
EOF
```

---

## Plan format

```json
{
  "goal": "Open example.com and extract the main heading",
  "steps": [
    {
      "id": "go",
      "action": { "type": "navigate", "url": "https://example.com" },
      "expect": { "urlIncludes": "example.com" }
    },
    {
      "action": { "type": "dismiss_overlays" },
      "optional": true
    },
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

### Supported actions

`navigate` · `click` · `type` · `select` · `wait` · `scroll` · `extract` · `press` · `dismiss_overlays` · `observe` · `new_tab` · `switch_tab` · `close_tab`

Targets prefer accessibility signals:

```json
{ "role": "button", "name": "Accept all" }
```

---

## Configuration

Optional project file:

```bash
npm run init-config   # writes ber.config.json
npm run doctor        # shows what will actually be used
```

- Env vars always win over file values
- `apiKey` may be omitted, `null`, or `"env:MY_VAR"`
- `ber.config.json` is gitignored

See [`examples/ber.config.example.json`](./examples/ber.config.example.json).

### Environment variables

| Variable | Required | Description |
|---|---|---|
| `BER_PORT` | no | Daemon port (default `8787`) |
| `BER_HOST` | no | Daemon host (default `127.0.0.1`) |
| `BER_URL` | no | Daemon URL for CLI `call` |
| `BER_DATA_DIR` | no | Data directory (default `./data`) |
| `BER_HEADLESS=0` | no | Show browser window |
| `BER_ALLOW_PURCHASE=1` | no | Allow purchase-like goals/clicks |
| `BER_DOMAINS` | no | Comma-separated domain allowlist |
| `BER_CONFIG` | no | Path to config file |
| `BER_PROVIDER` | no | Select `providers.<name>` from config |
| `BER_LLM_API_BASE` | no | OpenAI-compatible planner base URL |
| `BER_LLM_API_KEY` | no | Only if provider needs auth |
| `BER_LLM_MODEL` | no | Model id (default `llama3.2`) |
| `BER_EMBEDDINGS_API_BASE` | no | Optional neural embeddings endpoint |
| `BER_EMBEDDINGS_MODEL` | no | Embeddings model id |
| `BER_EMBEDDINGS=hash` | no | Force local hashing embeddings |
| `BER_HERMES_*` | no | Legacy aliases |

---

## Memory model

| Layer | Storage | Contents |
|---|---|---|
| L1 | RAM | Current session state / recent actions |
| L2 | SQLite (`data/experiences.db`) | Problem → fix experiences + confidence |
| L3 | Vectors in SQLite | Similarity search (hash by default) |

Important:

- Not a chat-log dump
- Not “save everything as JSON files”
- Fix steps are stored as a JSON column inside SQLite
- Neural embeddings are optional and provider-agnostic

---

## Programmatic usage (TypeScript)

```ts
import {
  createRuntimeFromEnv,
  BrowserRuntime,
  LlmPlanner,
} from "browser-execution-runtime";

// A) env / ber.config.json
const runtime = createRuntimeFromEnv();
await runtime.attach({ startUrl: "https://example.com" });
const result = await runtime.run({
  goal: "extract heading",
  steps: [
    { action: { type: "navigate", url: "https://example.com" } },
    {
      action: {
        type: "extract",
        target: { role: "heading", name: "Example Domain" },
        key: "heading",
      },
    },
  ],
});
console.log(result.ok, result.steps.at(-1)?.extracted);
await runtime.close();

// B) inject your own planner (any OpenAI-compatible server)
const custom = new BrowserRuntime({
  planner: new LlmPlanner({
    apiBase: "http://127.0.0.1:11434/v1",
    // apiKey omitted on purpose for local providers
    model: "llama3.2",
  }),
});
```

---

## Debug Chrome extension

Attach-only helper. **No model runs in the extension.**

1. `npm run daemon`
2. Chrome → `chrome://extensions` → Developer mode → **Load unpacked**
3. Select the [`extension/`](./extension) folder

Details: [`extension/README.md`](./extension/README.md)

For full control of an already-open Chrome:

```bash
google-chrome --remote-debugging-port=9222
curl -X POST http://127.0.0.1:8787/attach \
  -H 'content-type: application/json' \
  -d '{"cdpUrl":"http://127.0.0.1:9222"}'
```

---

## Project layout

```text
browser-execution-runtime/
├── src/
│   ├── runtime.ts          # public facade
│   ├── api/                # local HTTP daemon
│   ├── agent/              # tool schemas + client bridge
│   ├── browser/            # CDP session + tabs
│   ├── planner/            # builtin + LLM planner
│   ├── executor/           # actions + plan runner
│   ├── state/              # observe / diff / fingerprint
│   ├── recovery/           # failure classification
│   ├── experience/         # SQLite memory
│   ├── memory/             # L1 cache + embeddings
│   ├── plugins/            # site skills
│   ├── fallback/           # optional computer-use cascade
│   └── telemetry/          # metrics
├── examples/               # plans, tools, integrations
├── extension/              # Chrome debug bridge
├── sdk/python/             # thin Python client
├── benchmarks/             # replay benchmark
├── INTEGRATING.md          # bring-your-own-agent guide
├── ARCHITECTURE.md         # decided vs shipped matrix
└── PUBLISHING.md           # npm / PyPI notes
```

---

## Development

```bash
npm install
npx playwright install chromium
npm test
npm run typecheck
npm run build
npm run bench:replay
```

Useful docs:

- [`INTEGRATING.md`](./INTEGRATING.md) — wire any agent/provider
- [`ARCHITECTURE.md`](./ARCHITECTURE.md) — design status
- [`PUBLISHING.md`](./PUBLISHING.md) — release checklist
- [`LICENSE`](./LICENSE) — MIT

---

## Design principles

1. **Plan once, execute many** — keep the LLM off the hot path  
2. **Semantic state over screenshots** — diffs beat pixels for most steps  
3. **Remember recoveries** — don’t re-ask the model for the same cookie wall  
4. **Computer-use is fallback** — not the default loop  
5. **Stay open** — wrapper interface, not a locked SaaS client  

---

## License

[MIT](./LICENSE) — free to use, wrap, fork, and ship.
