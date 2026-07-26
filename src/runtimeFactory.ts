import { resolve } from "node:path";
import {
  HermesComputerUseFallback,
  createHermesPlannerFromEnv,
} from "./planner/hermes.js";
import { BuiltinPlanner } from "./planner/engine.js";
import { BrowserRuntime, type RuntimeOptions } from "./runtime.js";

export function createRuntimeFromEnv(
  overrides: RuntimeOptions = {},
): BrowserRuntime {
  const hermes = createHermesPlannerFromEnv();
  const planner = overrides.planner ?? hermes ?? new BuiltinPlanner();
  const computerUseFallback =
    overrides.computerUseFallback ??
    (hermes ? new HermesComputerUseFallback(hermes) : undefined);

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
