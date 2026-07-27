import { createServer, type Server } from "node:http";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Plan, Policy } from "../src/types.js";

const fixturesDir = join(fileURLToPath(new URL(".", import.meta.url)), "../fixtures");

export interface FixtureServer {
  baseUrl: string;
  url: (path?: string) => string;
  close: () => void;
}

export function startFixtureServer(fixtureFile: string, pathname = "/"): Promise<FixtureServer> {
  const html = readFileSync(join(fixturesDir, fixtureFile), "utf8");
  const server: Server = createServer((req, res) => {
    const path = (req.url ?? "/").split("?")[0] || "/";
    if (path !== pathname && pathname !== "/") {
      res.writeHead(404);
      res.end("not found");
      return;
    }
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    res.end(html);
  });

  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const addr = server.address();
      if (!addr || typeof addr === "string") {
        reject(new Error("no port"));
        return;
      }
      const baseUrl = `http://127.0.0.1:${addr.port}`;
      const path = pathname.startsWith("/") ? pathname : `/${pathname}`;
      resolve({
        baseUrl,
        url: (p = path) => `${baseUrl}${p.startsWith("/") ? p : `/${p}`}`,
        close: () => server.close(),
      });
    });
  });
}

export interface ReplayScenario {
  id: string;
  fixture: string;
  fixturePath?: string;
  /** Estimated vision/LLM calls for a naive computer-use agent (two passes unless singlePass). */
  baselineEstimatedLlmCalls: number;
  plan: (baseUrl: string) => Plan;
  policy?: Partial<Policy>;
  /** Run only one pass (no memory replay comparison). */
  singlePass?: boolean;
}

export interface PassSummary {
  ok: boolean;
  llmCallsAvoided: number;
  experienceHits: number;
  recoveries: number;
  error?: string;
}

export interface ReplayReport {
  scenario: string;
  fixture: string;
  first: PassSummary;
  second?: PassSummary;
  comparison: {
    baselineEstimatedLlmCalls: number;
    runtimeEffectiveReasoningCalls: number;
    estimatedSavingsPct: number;
    experiencesStored: number;
  };
}

export function summarizePass(result: {
  ok: boolean;
  llmCallsAvoided: number;
  metrics?: { experienceHits?: number; recoveries?: number };
  error?: string;
}): PassSummary {
  return {
    ok: result.ok,
    llmCallsAvoided: result.llmCallsAvoided,
    experienceHits: result.metrics?.experienceHits ?? 0,
    recoveries: result.metrics?.recoveries ?? 0,
    error: result.error,
  };
}

export function comparisonBlock(
  baseline: number,
  first: PassSummary,
  second: PassSummary | undefined,
  experienceCount: number,
): ReplayReport["comparison"] {
  const avoided = first.llmCallsAvoided + (second?.llmCallsAvoided ?? 0);
  const runtimeEffective = Math.max(0, baseline - avoided);
  return {
    baselineEstimatedLlmCalls: baseline,
    runtimeEffectiveReasoningCalls: runtimeEffective,
    estimatedSavingsPct: Number(
      (((baseline - runtimeEffective) / baseline) * 100).toFixed(1),
    ),
    experiencesStored: experienceCount,
  };
}
