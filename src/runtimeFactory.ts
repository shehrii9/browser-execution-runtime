import { resolve } from "node:path";
import { createComputerUseFallbackFromEnv } from "./fallback/computerUse.js";
import {
  HermesComputerUseFallback,
  createHermesPlannerFromEnv,
} from "./planner/hermes.js";
import { BuiltinPlanner, NoopComputerUseFallback } from "./planner/engine.js";
import { BrowserRuntime, type RuntimeOptions } from "./runtime.js";

export function createRuntimeFromEnv(
  overrides: RuntimeOptions = {},
): BrowserRuntime {
  const hermes = createHermesPlannerFromEnv();
  const planner = overrides.planner ?? hermes ?? new BuiltinPlanner();

  const envFallback = createComputerUseFallbackFromEnv();
  const computerUseFallback =
    overrides.computerUseFallback ??
    envFallback ??
    (hermes ? new HermesComputerUseFallback(hermes) : new NoopComputerUseFallback());

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
