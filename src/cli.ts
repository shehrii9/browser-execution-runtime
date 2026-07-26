#!/usr/bin/env node
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { createDefaultBridge } from "./agent/bridge.js";
import { AGENT_TOOLS } from "./agent/tools.js";
import { startDaemon } from "./api/server.js";
import { defaultPersistentProfileDir } from "./browser/profiles.js";
import { resolveLlmEnv } from "./planner/llm.js";
import { createRuntimeFromEnv } from "./runtimeFactory.js";
import { PlanSchema } from "./types.js";

async function main(): Promise<void> {
  const [command, ...rest] = process.argv.slice(2);

  if (!command || command === "help" || command === "--help" || command === "-h") {
    printHelp();
    return;
  }

  if (command === "tools" || command === "hermes-tools") {
    const out = rest[0];
    const payload = JSON.stringify({ tools: AGENT_TOOLS }, null, 2);
    if (out) writeFileSync(out, `${payload}\n`);
    else console.log(payload);
    return;
  }

  if (command === "call" || command === "hermes-call") {
    const name = rest[0];
    const argsJson = rest[1] ?? "{}";
    if (!name) throw new Error('Usage: ber call <toolName> \'{"intent":"..."}\'');
    const bridge = createDefaultBridge();
    const result = await bridge.handle({
      name,
      arguments: JSON.parse(argsJson) as Record<string, unknown>,
    });
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  if (command === "doctor") {
    const llm = resolveLlmEnv();
    console.log(
      JSON.stringify(
        {
          mode: llm.apiBase ? "llm+runtime" : "runtime-only",
          llm: {
            apiBase: llm.apiBase ?? null,
            apiKeyConfigured: Boolean(llm.apiKey),
            model: llm.model,
            note: "API key is optional. Local OpenAI-compatible servers usually need none.",
          },
          daemon: process.env.BER_URL ?? "http://127.0.0.1:8787",
        },
        null,
        2,
      ),
    );
    return;
  }

  const runtime = createRuntimeFromEnv();

  try {
    switch (command) {
      case "daemon": {
        const port = Number(process.env.BER_PORT ?? 8787);
        const llm = resolveLlmEnv();
        console.log(
          `planner: ${llm.apiBase ? `LLM @ ${llm.apiBase} (${llm.model})` : "builtin (no LLM required)"}`,
        );
        startDaemon({ runtime, port });
        process.on("SIGINT", async () => {
          await runtime.close();
          process.exit(0);
        });
        return;
      }
      case "attach": {
        const startUrl = rest[0];
        const profile = rest.includes("--persistent")
          ? defaultPersistentProfileDir()
          : undefined;
        const state = await runtime.attach({
          startUrl,
          userDataDir: profile,
        });
        console.log(JSON.stringify(state, null, 2));
        await runtime.close();
        return;
      }
      case "run-plan": {
        const planPath = rest[0];
        if (!planPath) throw new Error("Usage: ber run-plan <plan.json> [startUrl]");
        const startUrl = rest[1];
        const plan = PlanSchema.parse(JSON.parse(readFileSync(planPath, "utf8")));
        await runtime.attach({ startUrl });
        const result = await runtime.run(plan);
        console.log(JSON.stringify(result, null, 2));
        await runtime.close();
        process.exitCode = result.ok ? 0 : 1;
        return;
      }
      case "execute": {
        const intent = rest.join(" ").trim();
        if (!intent) throw new Error('Usage: ber execute "open https://example.com"');
        await runtime.attach();
        const result = await runtime.execute(intent);
        console.log(JSON.stringify(result, null, 2));
        await runtime.close();
        process.exitCode = result.ok ? 0 : 1;
        return;
      }
      case "observe": {
        const startUrl = rest[0] ?? "https://example.com";
        await runtime.attach({ startUrl });
        const state = await runtime.observe();
        console.log(JSON.stringify(state, null, 2));
        await runtime.close();
        return;
      }
      default:
        throw new Error(`Unknown command: ${command}`);
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    await runtime.close().catch(() => undefined);
    process.exitCode = 1;
  }
}

function printHelp(): void {
  console.log(`browser-execution-runtime (ber)

Open wrapper for AI browser agents. No vendor lock-in. API key optional.

Commands:
  daemon                     Start local HTTP daemon (default :8787)
  doctor                     Show planner/wiring mode
  attach [url] [--persistent]
  observe [url]
  run-plan <file> [url]
  execute "<intent>"
  tools [outfile]            Print OpenAI-style tool schemas
  call <tool> <json>         Call daemon through tool bridge

Env (all optional except when you want an external LLM planner):
  BER_LLM_API_BASE           Any OpenAI-compatible base, e.g. http://127.0.0.1:11434/v1
  BER_LLM_API_KEY            Optional. Omit for local/no-auth providers
  BER_LLM_MODEL              Model name (default llama3.2)
  BER_PORT / BER_URL / BER_DATA_DIR / BER_HEADLESS / BER_DOMAINS

Quick start (no API key):
  npm run daemon
  npm run dev -- run-plan examples/sample-plan.json

With local Ollama (no key):
  BER_LLM_API_BASE=http://127.0.0.1:11434/v1 BER_LLM_MODEL=llama3.2 npm run daemon

Wire any agent:
  npm run dev -- tools examples/agent-tools.json
`);
}

main();
