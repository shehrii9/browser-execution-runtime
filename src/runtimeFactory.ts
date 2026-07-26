import { resolve } from "node:path";
import { createComputerUseFallbackFromEnv } from "./fallback/computerUse.js";
import {
  LlmComputerUseFallback,
  createLlmPlannerFromEnv,
} from "./planner/llm.js";
import { BuiltinPlanner, NoopComputerUseFallback } from "./planner/engine.js";
import { BrowserRuntime, type RuntimeOptions } from "./runtime.js";

/**
 * Build a runtime from environment.
 * Works with:
 * - no LLM at all (builtin planner + explicit plans)
 * - any OpenAI-compatible local/remote endpoint
 * - optional API key (not required for many local servers)
 */
export function createRuntimeFromEnv(
  overrides: RuntimeOptions = {},
): BrowserRuntime {
  const llm = createLlmPlannerFromEnv();
  const planner = overrides.planner ?? llm ?? new BuiltinPlanner();

  const envFallback = createComputerUseFallbackFromEnv();
  const computerUseFallback =
    overrides.computerUseFallback ??
    envFallback ??
    (llm ? new LlmComputerUseFallback(llm) : new NoopComputerUseFallback());

  return new BrowserRuntime({
    dataDir: overrides.dataDir ?? resolve(process.env.BER_DATA_DIR ?? "data"),
    policy: {
      headless: process.env.BER_HEADLESS !== "0",
      allowPurchase: process.env.BER_ALLOW_PURCHASE === "1",
      domains: (process.env.BER_DOMAINS ?? "")
        .split(",")
        .map((d) => d.trim())
        .filter(Boolean),
      allowNavigationOutsideAllowlist: !process.env.BER_DOMAINS,
      ...overrides.policy,
    },
    planner,
    computerUseFallback,
  });
}
