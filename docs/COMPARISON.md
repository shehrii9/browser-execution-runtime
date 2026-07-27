# How this compares to common “AI browser” setups

Short reference for choosing an approach. This project is **Browser Execution Runtime (BER)** — a local execution kernel, not a hosted agent product.

## Two common patterns

| Pattern | Typical flow | Cost / latency | Lock-in |
|---------|----------------|----------------|---------|
| **Vision / computer-use loop** | Screenshot → model → action → repeat | High token use every step; slower | Often tied to one vendor’s tools API |
| **BER (this repo)** | Plan or intent once → deterministic steps + semantic observe/diff → recovery/memory | Model mostly off the hot path | Open wrapper; any OpenAI-compatible planner optional |

```text
Computer-use loop:     [pixels] → LLM → [pixels] → LLM → …

BER:                   LLM (optional) → JSON plan
                              ↓
                       execute many steps (CDP)
                              ↓
                       observe / diff / recover (local)
```

## When BER fits well

- You already have an agent (Cursor, Codex, custom) and want **stable `browser_*` tools** or HTTP daemon calls
- You want **no API key** for the runtime itself (local Ollama/vLLM optional)
- Steps are mostly clicks, forms, navigation, extract — not “describe every pixel”
- You care about **cookie/login recovery** and remembering fixes in SQLite

## When something else may fit better

- The task is purely visual (CAPTCHA solving, canvas games, heavy OCR) — use vision fallback sparingly or a dedicated CV pipeline
- You need a managed cloud browser fleet with compliance SLAs — BER is local-first
- You want a single vendor’s end-to-end agent IDE — BER is a library/daemon to embed

## Computer-use in BER

BER includes an optional **fallback** hook for vision/computer-use when semantic recovery is exhausted — it is not the default loop. See `src/fallback/` and [`ARCHITECTURE.md`](../ARCHITECTURE.md).

## Related reading

- [`README.md`](../README.md) — features and quick start
- [`INTEGRATING.md`](../INTEGRATING.md) — wire your agent
- [`ROADMAP.md`](../ROADMAP.md) — what we are building next
