# Integrating any agent (no vendor lock-in)

This runtime is an **open wrapper**. Anyone can wire it up.

- No required API key
- No required cloud provider
- Works with explicit JSON plans alone
- Optional LLM planner via any OpenAI-compatible endpoint

## Modes

### 1) Runtime-only (zero LLM)

```bash
npm run daemon
npm run dev -- run-plan examples/sample-plan.json
```

Your agent (or script) sends plans to `POST /run`. No model needed.

### 2) Local open model (no key)

```bash
# Ollama example
BER_LLM_API_BASE=http://127.0.0.1:11434/v1 \
BER_LLM_MODEL=llama3.2 \
npm run daemon
```

### 3) Hosted provider (key optional depending on provider)

```bash
BER_LLM_API_BASE=https://api.openai.com/v1 \
BER_LLM_API_KEY=sk-... \
BER_LLM_MODEL=gpt-4.1-mini \
npm run daemon
```

Hermes / vLLM / LM Studio / OpenRouter all work the same way: point `BER_LLM_API_BASE` at an OpenAI-compatible `/v1`.

## Wire your agent

1. Start daemon: `npm run daemon`
2. Export tools: `npm run dev -- tools examples/agent-tools.json`
3. Register those tools in your agent
4. Prefer `browser_*` tools over computer-use

Or call HTTP directly:

```bash
curl -X POST http://127.0.0.1:8787/attach -H 'content-type: application/json' -d '{"startUrl":"https://example.com"}'
curl -X POST http://127.0.0.1:8787/run -H 'content-type: application/json' -d @- <<'EOF'
{"plan":{"goal":"open example","steps":[{"action":{"type":"navigate","url":"https://example.com"}}]}}
EOF
```

## Programmatic wrapper

```ts
import {
  createRuntimeFromEnv,
  LlmPlanner,
  BrowserRuntime,
} from "browser-execution-runtime";

// A) env-driven
const runtime = createRuntimeFromEnv();

// B) inject your own planner (any provider)
const custom = new BrowserRuntime({
  planner: new LlmPlanner({
    apiBase: "http://127.0.0.1:11434/v1",
    // apiKey omitted on purpose
    model: "llama3.2",
  }),
});
```

## Check wiring

```bash
npm run dev -- doctor
```

## Env reference

| Var | Required | Meaning |
|---|---|---|
| `BER_LLM_API_BASE` | no | OpenAI-compatible base URL |
| `BER_LLM_API_KEY` | no | Only if your provider needs auth |
| `BER_LLM_MODEL` | no | Model id (default `llama3.2`) |
| `BER_URL` | no | Daemon URL for tool bridge |
| `BER_HERMES_*` | no | Legacy aliases for Hermes users |

See `examples/ber.config.example.json` for provider examples.
