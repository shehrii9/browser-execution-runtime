# Contributor call (copy-paste drafts)

Adjust links and tone for your channel.

---

## Short (Twitter / X / Mastodon)

Open-source browser execution kernel for AI agents — plan once, execute many, no vendor API key for the runtime.

Looking for help with **site plugins**, **recovery tests**, and **agent integration examples**.

`https://github.com/shehrii9/browser-execution-runtime`

Good first issues: `https://github.com/shehrii9/browser-execution-runtime/issues?q=label%3A%22good+first+issue%22`

---

## Hacker News (Show HN style)

**Show HN: Browser Execution Runtime – open CDP kernel for agents (no API key required)**

Most agent browser setups re-send screenshots to a model every step. This is a local TypeScript runtime that runs JSON plans against Chromium (Playwright/CDP), exposes semantic observe/diff, recovery (cookie/login modals), optional SQLite experience memory, and OpenAI-style `browser_*` tools for any agent.

- MIT, Node 20+, `npm start` → daemon on :8787
- LLM optional (Ollama/OpenAI-compatible)
- Repo: https://github.com/shehrii9/browser-execution-runtime

I'd love contributors on site plugins (media/news hosts), tests, and integration docs. CONTRIBUTING.md + labeled good-first issues are up.

---

## Reddit (r/LocalLLaMA, r/selfhosted, r/MachineLearning)

Title: **Open-source browser execution layer for agents (CDP, no required API key)**

Body:

I maintain Browser Execution Runtime — a local daemon + library that sits between your agent and Chromium. You send plans or intents; it executes clicks/navigation/extract with recovery and memory instead of burning vision tokens every step.

Works with Cursor/Codex-style tool bridges, curl, or Python client. Optional planner via any OpenAI-compatible endpoint (Ollama etc.).

Contributing: https://github.com/shehrii9/browser-execution-runtime/blob/main/CONTRIBUTING.md

Comparison to computer-use loops: https://github.com/shehrii9/browser-execution-runtime/blob/main/docs/COMPARISON.md

---

## Discord / Slack one-liner

**BER** = local browser execution for agents (CDP + plans + recovery). MIT. Good first issues on GitHub for plugins/tests/docs.
