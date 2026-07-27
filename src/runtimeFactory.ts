import { resolve } from "node:path";
import { loadBerConfig } from "./config.js";
import { createComputerUseFallbackFromEnv } from "./fallback/computerUse.js";
import {
  LlmComputerUseFallback,
  LlmPlanner,
} from "./planner/llm.js";
import { BuiltinPlanner, NoopComputerUseFallback } from "./planner/engine.js";
import { createPluginRegistry } from "./plugins/registry.js";
import { policyDefaultsFromEnv } from "./policy.js";
import { BrowserRuntime, type RuntimeOptions } from "./runtime.js";

/**
 * Build a runtime from optional ber.config.json + environment.
 * Works with no LLM, local open models, or any OpenAI-compatible provider.
 * API key is never required by this runtime itself.
 */
export function createRuntimeFromEnv(
  overrides: RuntimeOptions & { configPath?: string; cwd?: string } = {},
): BrowserRuntime {
  const cfg = loadBerConfig({
    configPath: overrides.configPath,
    cwd: overrides.cwd,
  });

  // Expose resolved LLM settings to existing env-based helpers.
  if (cfg.llm.apiBase && !process.env.BER_LLM_API_BASE && !process.env.BER_HERMES_API_BASE) {
    process.env.BER_LLM_API_BASE = cfg.llm.apiBase;
  }
  if (cfg.llm.apiKey && !process.env.BER_LLM_API_KEY && !process.env.OPENAI_API_KEY) {
    process.env.BER_LLM_API_KEY = cfg.llm.apiKey;
  }
  if (cfg.llm.model && !process.env.BER_LLM_MODEL && !process.env.BER_HERMES_MODEL) {
    process.env.BER_LLM_MODEL = cfg.llm.model;
  }
  if (cfg.llm.visionModel && !process.env.BER_COMPUTER_USE_MODEL) {
    process.env.BER_COMPUTER_USE_MODEL = cfg.llm.visionModel;
  }

  const llm = cfg.llm.apiBase
    ? new LlmPlanner({
        apiBase: cfg.llm.apiBase,
        apiKey: cfg.llm.apiKey,
        model: cfg.llm.model,
        timeoutMs: cfg.llm.timeoutMs,
      })
    : null;

  const plugins = overrides.plugins ?? createPluginRegistry(cfg.configPlugins);
  const resolvedPlanner =
    overrides.planner ?? llm ?? new BuiltinPlanner(plugins);
  const envFallback = createComputerUseFallbackFromEnv();
  const computerUseFallback =
    overrides.computerUseFallback ??
    envFallback ??
    (llm ? new LlmComputerUseFallback(llm) : new NoopComputerUseFallback());

  return new BrowserRuntime({
    dataDir: overrides.dataDir ?? resolve(cfg.dataDir),
    policy: {
      ...policyDefaultsFromEnv(),
      headless: cfg.headless,
      allowPurchase: cfg.allowPurchase,
      domains: cfg.domains,
      allowNavigationOutsideAllowlist: cfg.domains.length === 0,
      ...overrides.policy,
    },
    planner: resolvedPlanner,
    computerUseFallback,
    plugins,
  });
}

export function getResolvedConfig(options?: { configPath?: string; cwd?: string }) {
  return loadBerConfig(options);
}
