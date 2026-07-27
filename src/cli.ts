#!/usr/bin/env node
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { createDefaultBridge } from "./agent/bridge.js";
import { AGENT_TOOLS } from "./agent/tools.js";
import { startDaemon } from "./api/server.js";
import { defaultPersistentProfileDir } from "./browser/profiles.js";
import { getResolvedConfig, createRuntimeFromEnv } from "./runtimeFactory.js";
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
    const cfg = getResolvedConfig();
    console.log(
      JSON.stringify(
        {
          mode: cfg.llm.apiBase ? "llm+runtime" : "runtime-only",
          configPath: cfg.configPath ?? null,
          llm: {
            apiBase: cfg.llm.apiBase ?? null,
            apiKeyConfigured: Boolean(cfg.llm.apiKey),
            model: cfg.llm.model,
            note: "API key is optional. Local OpenAI-compatible servers usually need none.",
          },
          runtime: {
            host: cfg.host,
            port: cfg.port,
            headless: cfg.headless,
            dataDir: cfg.dataDir,
            domains: cfg.domains,
          },
          daemon: process.env.BER_URL ?? `http://${cfg.host}:${cfg.port}`,
        },
        null,
        2,
      ),
    );
    return;
  }

  if (command === "init-config") {
    const out = resolve(rest[0] ?? "ber.config.json");
    const example = readFileSync(
      resolve("examples/ber.config.example.json"),
      "utf8",
    );
    writeFileSync(out, example);
    console.log(`Wrote ${out}`);
    return;
  }

  const cfg = getResolvedConfig();
  const runtime = createRuntimeFromEnv();

  try {
    switch (command) {
      case "daemon": {
        const port = Number(process.env.BER_PORT ?? cfg.port);
        const host = process.env.BER_HOST ?? cfg.host;
        console.log(
          `planner: ${cfg.llm.apiBase ? `LLM @ ${cfg.llm.apiBase} (${cfg.llm.model})` : "builtin (no LLM required)"}`,
        );
        if (cfg.configPath) console.log(`config: ${cfg.configPath}`);
        startDaemon({ runtime, port, host });
        process.on("SIGINT", async () => {
          await runtime.close();
          process.exit(0);
        });
        return;
      }
      case "attach": {
        const startUrl = rest[0];
        const profile = rest.includes("--persistent")
          ? defaultPersistentProfileDir(cfg.dataDir)
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
  daemon                     Start local HTTP daemon
  doctor                     Show config/planner wiring
  init-config [path]         Write ber.config.json from example
  attach [url] [--persistent]
  observe [url]
  run-plan <file> [url]
  execute "<intent>"
  tools [outfile]            Print OpenAI-style tool schemas
  call <tool> <json>         Call daemon through tool bridge

Config:
  ber.config.json            Optional project config
  BER_CONFIG                 Path override
  BER_PROVIDER               Select providers.<name> from config
  BER_LLM_API_BASE/KEY/MODEL Optional LLM wiring (key optional)

Quick start (no API key):
  npm run init-config
  npm run daemon
  npm run dev -- run-plan examples/sample-plan.json
`);
}

main();
