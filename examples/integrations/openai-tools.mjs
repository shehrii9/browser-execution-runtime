/**
 * Minimal example: use this runtime as OpenAI-style tools from any JS agent.
 * No API key required for the runtime itself.
 *
 * Usage:
 *   npm run daemon
 *   node examples/integrations/openai-tools.mjs
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const BASE = process.env.BER_URL ?? "http://127.0.0.1:8787";
const tools = JSON.parse(
  readFileSync(resolve("examples/agent-tools.json"), "utf8"),
).tools;

async function callTool(name, args = {}) {
  const map = {
    browser_attach: () => post("/attach", args),
    browser_execute: () => post("/execute", args),
    browser_run_plan: () => post("/run", args),
    browser_observe: () => get("/observe"),
    browser_diff: () => get("/diff"),
    browser_resume: () => post("/resume", {}),
    browser_status: () => get("/status"),
    browser_tabs: () => get("/tabs"),
  };
  const fn = map[name];
  if (!fn) throw new Error(`Unknown tool ${name}`);
  return fn();
}

async function get(path) {
  const res = await fetch(`${BASE}${path}`);
  return res.json();
}

async function post(path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body ?? {}),
  });
  return res.json();
}

const attach = await callTool("browser_attach", {
  startUrl: "https://example.com",
});
const run = await callTool("browser_run_plan", {
  plan: {
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
  },
});

console.log(
  JSON.stringify(
    {
      availableTools: tools.map((t) => t.function.name),
      attached: Boolean(attach.ok),
      heading: run.steps?.find((s) => s.extracted?.heading)?.extracted?.heading,
      ok: run.ok,
    },
    null,
    2,
  ),
);
