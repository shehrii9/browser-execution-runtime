#!/usr/bin/env node
/**
 * One-command first startup for Browser Execution Runtime.
 *
 *   npm start
 *
 * Idempotent: installs deps if needed, ensures Chromium, writes config once,
 * then starts the daemon.
 */
import { spawn, spawnSync } from "node:child_process";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
} from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
process.chdir(root);

function run(cmd, args, label) {
  console.log(`→ ${label}`);
  const result = spawnSync(cmd, args, {
    stdio: "inherit",
    env: process.env,
    shell: false,
  });
  if (result.status !== 0) {
    console.error(`Failed: ${label}`);
    process.exit(result.status ?? 1);
  }
}

console.log("Browser Execution Runtime — one-command setup\n");

if (!existsSync(resolve(root, "node_modules"))) {
  run("npm", ["install"], "Install npm dependencies");
} else {
  console.log("→ npm dependencies already present");
}

run(
  "npx",
  ["playwright", "install", "chromium"],
  "Ensure Playwright Chromium",
);

const configPath = resolve(root, "ber.config.json");
const examplePath = resolve(root, "examples/ber.config.example.json");
if (!existsSync(configPath) && existsSync(examplePath)) {
  copyFileSync(examplePath, configPath);
  console.log("→ Wrote ber.config.json");
} else {
  console.log("→ ber.config.json ready");
}

const setupOnly =
  process.argv.includes("--setup-only") || process.env.BER_SETUP_ONLY === "1";

mkdirSync(resolve(root, "data"), { recursive: true });

if (setupOnly) {
  console.log("\nSetup complete. Start the engine with: npm start\n");
  process.exit(0);
}

const useDist = existsSync(resolve(root, "dist/cli.js"));
const child = useDist
  ? spawn("node", ["dist/cli.js", "daemon"], {
      stdio: "inherit",
      env: process.env,
    })
  : spawn("npx", ["tsx", "src/cli.ts", "daemon"], {
      stdio: "inherit",
      env: process.env,
    });

console.log(
  `\n→ Starting daemon (planner/runtime on :8787)${useDist ? " via dist" : " via tsx"}…\n`,
);

child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  process.exit(code ?? 0);
});

for (const sig of ["SIGINT", "SIGTERM"]) {
  process.on(sig, () => {
    child.kill(sig);
  });
}
