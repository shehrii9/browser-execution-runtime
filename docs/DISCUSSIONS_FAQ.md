# Discussions FAQ (pin or copy into GitHub Discussions)

Use this as the first **Announcements** or **Q&A** post after enabling [GitHub Discussions](https://github.com/shehrii9/browser-execution-runtime/discussions).

---

## What is this project?

An open, provider-agnostic **browser execution runtime** for AI agents: Chromium via CDP, JSON plans, semantic observe/diff, recovery, optional SQLite memory. **No API key required** for the runtime.

## Do I need an LLM?

No. `npm run dev -- run-plan examples/sample-plan.json` runs without any model. An OpenAI-compatible planner is optional (`BER_LLM_*`).

## How do I try it in 2 minutes?

```bash
npm install && npm start
# other terminal:
bash examples/integrations/curl-demo.sh
```

Full walkthrough: [`examples/QUICK_DEMO.md`](../examples/QUICK_DEMO.md).

## Cursor / Codex / custom agent?

See [`INTEGRATING.md`](../INTEGRATING.md) and [`examples/integrations/cursor-rules.md`](../examples/integrations/cursor-rules.md).

## Where should I ask questions vs file bugs?

- **Questions, ideas, show-and-tell** → Discussions (Q&A)
- **Reproducible bugs** → Issues → Bug report template
- **Security** → Private advisory per [`SECURITY.md`](../SECURITY.md)

## I want to contribute — where do I start?

[`CONTRIBUTING.md`](../CONTRIBUTING.md) and [`GOOD_FIRST_ISSUES.md`](../GOOD_FIRST_ISSUES.md).

## Is this production-ready?

MIT OSS, local daemon default `127.0.0.1`. You are responsible for network exposure, domain allowlists, and purchase policies. See [`SECURITY.md`](../SECURITY.md).
