#!/usr/bin/env node
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { startDaemon } from "./api/server.js";
import { defaultPersistentProfileDir } from "./browser/profiles.js";
import { createDefaultBridge } from "./hermes/bridge.js";
import { HERMES_TOOLS } from "./hermes/tools.js";
import { createRuntimeFromEnv } from "./runtimeFactory.js";
import { PlanSchema } from "./types.js";

async function main(): Promise<void> {
  const [command, ...rest] = process.argv.slice(2);

  if (!command || command === "help" || command === "--help" || command === "-h") {
    printHelp();
    return;
  }

  // Lightweight commands that don't need a local browser runtime instance.
  if (command === "hermes-tools") {
    const out = rest[0];
    const payload = JSON.stringify({ tools: HERMES_TOOLS }, null, 2);
    if (out) writeFileSync(out, `${payload}\n`);
    else console.log(payload);
    return;
  }

  if (command === "hermes-call") {
    const name = rest[0];
    const argsJson = rest[1] ?? "{}";
    if (!name) throw new Error('Usage: ber hermes-call <toolName> \'{"intent":"..."}\'');
    const bridge = createDefaultBridge();
    const result = await bridge.handle({
      name,
      arguments: JSON.parse(argsJson) as Record<string, unknown>,
    });
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  const runtime = createRuntimeFromEnv();

  try {
    switch (command) {
      case "daemon": {
        const port = Number(process.env.BER_PORT ?? 8787);
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

Commands:
  daemon                     Start local HTTP daemon (default :8787)
  attach [url] [--persistent]
  observe [url]
  run-plan <file> [url]
  execute "<intent>"
  hermes-tools [outfile]     Print/write OpenAI-style tool schemas
  hermes-call <tool> <json>  Call daemon through Hermes tool bridge

Env:
  BER_PORT / BER_URL / BER_DATA_DIR
  BER_HEADLESS=0
  BER_ALLOW_PURCHASE=1
  BER_DOMAINS=a.com,b.com
  BER_CHROME_CHANNEL
  BER_HERMES_API_BASE        OpenAI-compatible Hermes endpoint
  BER_HERMES_API_KEY
  BER_HERMES_MODEL

Hermes quick start:
  1) BER_HERMES_API_BASE=... npm run daemon
  2) npm run dev -- hermes-tools /tmp/hermes-tools.json
  3) Point Hermes tools at those schemas / use hermes-call
`);
}

main();
