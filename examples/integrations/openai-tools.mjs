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
import { callBerTool, TOOL_HTTP_ROUTES } from "./toolHttp.mjs";

const BASE = process.env.BER_URL ?? "http://127.0.0.1:8787";
const tools = JSON.parse(
  readFileSync(resolve("examples/agent-tools.json"), "utf8"),
).tools;

async function callTool(name, args = {}) {
  return callBerTool(BASE, name, args);
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
      routedTools: Object.keys(TOOL_HTTP_ROUTES),
      attached: Boolean(attach.ok),
      heading: run.steps?.find((s) => s.extracted?.heading)?.extracted?.heading,
      ok: run.ok,
    },
    null,
    2,
  ),
);
