import { createServer } from "node:http";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { BrowserRuntime } from "../src/runtime.js";

async function main(): Promise<void> {
  const html = readFileSync(new URL("../fixtures/cookie-shop.html", import.meta.url), "utf8");
  const server = createServer((req, res) => {
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    res.end(html);
  });

  const port = await new Promise<number>((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const addr = server.address();
      if (!addr || typeof addr === "string") throw new Error("No port");
      resolve(addr.port);
    });
  });

  const url = `http://127.0.0.1:${port}/`;
  const dataDir = mkdtempSync(join(tmpdir(), "ber-bench-"));
  const runtime = new BrowserRuntime({
    dataDir,
    policy: { headless: true, maxRecoveries: 4, allowPurchase: true },
  });

  const plan = {
    goal: "Finish cart flow on cookie shop",
    steps: [
      { action: { type: "navigate" as const, url } },
      {
        action: {
          type: "click" as const,
          target: { role: "button", name: "Checkout" },
        },
      },
      {
        action: { type: "wait" as const, text: "Done" },
      },
    ],
  };

  try {
    await runtime.attach({ startUrl: url });

    const first = await runtime.run(plan);
    const second = await runtime.run(plan);

    // Naive computer-use baseline estimate:
    // one vision/LLM call per action attempt, plus one per recovery exploration.
    const baselineLlmCalls =
      plan.steps.length + // first pass
      2 + // likely overlay discovery + accept
      plan.steps.length; // second pass still re-reasons every step

    const runtimeLlmCalls =
      // planner not used (explicit plan). Count "reasoning calls" avoided via memory/heuristics.
      Math.max(0, baselineLlmCalls - (first.llmCallsAvoided + second.llmCallsAvoided));

    const report = {
      fixture: url,
      dataDir,
      first: {
        ok: first.ok,
        llmCallsAvoided: first.llmCallsAvoided,
        experienceHits: first.metrics?.experienceHits ?? 0,
        recoveries: first.metrics?.recoveries ?? 0,
        error: first.error,
      },
      second: {
        ok: second.ok,
        llmCallsAvoided: second.llmCallsAvoided,
        experienceHits: second.metrics?.experienceHits ?? 0,
        recoveries: second.metrics?.recoveries ?? 0,
        error: second.error,
      },
      comparison: {
        baselineEstimatedLlmCalls: baselineLlmCalls,
        runtimeEffectiveReasoningCalls: runtimeLlmCalls,
        estimatedSavingsPct: Number(
          (
            ((baselineLlmCalls - runtimeLlmCalls) / baselineLlmCalls) *
            100
          ).toFixed(1),
        ),
        experiencesStored: (await runtime.status()).experienceCount,
      },
    };

    console.log(JSON.stringify(report, null, 2));
    if (!first.ok || !second.ok) process.exitCode = 1;
  } finally {
    await runtime.close();
    server.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
