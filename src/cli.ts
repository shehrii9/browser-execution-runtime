#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { startDaemon } from "./api/server.js";
import { BrowserRuntime } from "./runtime.js";
import { PlanSchema } from "./types.js";

async function main(): Promise<void> {
  const [command, ...rest] = process.argv.slice(2);

  if (!command || command === "help" || command === "--help" || command === "-h") {
    printHelp();
    return;
  }

  const runtime = new BrowserRuntime({
    dataDir: process.env.BER_DATA_DIR ?? resolve("data"),
    policy: {
      headless: process.env.BER_HEADLESS !== "0",
      allowPurchase: process.env.BER_ALLOW_PURCHASE === "1",
      domains: (process.env.BER_DOMAINS ?? "")
        .split(",")
        .map((d) => d.trim())
        .filter(Boolean),
      allowNavigationOutsideAllowlist: !process.env.BER_DOMAINS,
    },
  });

  try {
    switch (command) {
      case "daemon": {
        const port = Number(process.env.BER_PORT ?? 8787);
        startDaemon({ runtime, port });
        // Keep process alive; runtime closed via /close or process signal.
        process.on("SIGINT", async () => {
          await runtime.close();
          process.exit(0);
        });
        return;
      }
      case "attach": {
        const startUrl = rest[0];
        const state = await runtime.attach({ startUrl });
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
  attach [url]               Launch browser and print semantic state
  observe [url]              Observe a page and print semantic state
  run-plan <file> [url]      Execute an explicit JSON plan
  execute "<intent>"         Run a built-in intent (open/search)

Env:
  BER_PORT                   Daemon port (default 8787)
  BER_DATA_DIR               Data directory (default ./data)
  BER_HEADLESS=0             Show browser window
  BER_ALLOW_PURCHASE=1       Allow purchase-like actions
  BER_DOMAINS=a.com,b.com    Domain allowlist
  BER_CHROME_CHANNEL         Playwright chrome channel

Hermes integration:
  1) npm run daemon
  2) POST /attach, /execute or /run with JSON plans
`);
}

main();
