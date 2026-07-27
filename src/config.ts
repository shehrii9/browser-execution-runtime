import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { z } from "zod";
import { loadConfigSitePlugins } from "./plugins/loadConfigPlugins.js";
import type { SitePlugin } from "./plugins/types.js";

const ConfigSchema = z.object({
  runtime: z
    .object({
      host: z.string().default("127.0.0.1"),
      port: z.number().int().positive().default(8787),
      headless: z.boolean().default(true),
      dataDir: z.string().default("./data"),
      allowPurchase: z.boolean().default(false),
      domains: z.array(z.string()).default([]),
    })
    .default({
      host: "127.0.0.1",
      port: 8787,
      headless: true,
      dataDir: "./data",
      allowPurchase: false,
      domains: [],
    }),
  llm: z
    .object({
      apiBase: z.string().nullable().optional(),
      apiKey: z.string().nullable().optional(),
      model: z.string().optional(),
      visionModel: z.string().optional(),
      timeoutMs: z.number().int().positive().optional(),
    })
    .default({}),
  provider: z.string().optional(),
  providers: z
    .record(
      z.string(),
      z.object({
        apiBase: z.string(),
        apiKey: z.string().nullable().optional(),
        model: z.string().optional(),
      }),
    )
    .default({}),
  /** Declarative site plugins (workflows + recovery action lists). */
  plugins: z.array(z.unknown()).optional(),
  /** Path to a JSON file with `{ "plugins": [ ... ] }` (relative to config file). */
  pluginsFile: z.string().optional(),
});

export type BerConfig = z.infer<typeof ConfigSchema>;

export interface ResolvedRuntimeConfig {
  host: string;
  port: number;
  headless: boolean;
  dataDir: string;
  allowPurchase: boolean;
  domains: string[];
  llm: {
    apiBase?: string;
    apiKey?: string;
    model: string;
    visionModel?: string;
    timeoutMs: number;
  };
  configPath?: string;
  configPlugins: SitePlugin[];
}

/**
 * Load optional ber.config.json.
 * Env vars always win over file values.
 * API keys may be omitted or set as "env:VAR_NAME".
 */
export function loadBerConfig(options: {
  cwd?: string;
  configPath?: string;
  env?: NodeJS.ProcessEnv;
} = {}): ResolvedRuntimeConfig {
  const env = options.env ?? process.env;
  const cwd = options.cwd ?? process.cwd();
  const candidates = [
    options.configPath,
    env.BER_CONFIG,
    resolve(cwd, "ber.config.json"),
    resolve(cwd, "examples/ber.config.example.json"),
  ].filter(Boolean) as string[];

  let fileConfig: BerConfig = ConfigSchema.parse({});
  let configPath: string | undefined;
  for (const candidate of candidates) {
    // Never auto-load the example file unless explicitly requested.
    if (
      candidate.endsWith("ber.config.example.json") &&
      options.configPath !== candidate &&
      env.BER_CONFIG !== candidate
    ) {
      continue;
    }
    if (!existsSync(candidate)) continue;
    fileConfig = ConfigSchema.parse(JSON.parse(readFileSync(candidate, "utf8")));
    configPath = candidate;
    break;
  }

  const selectedProvider =
    env.BER_PROVIDER || fileConfig.provider
      ? fileConfig.providers[env.BER_PROVIDER || fileConfig.provider || ""]
      : undefined;

  const fileLlm = {
    apiBase: selectedProvider?.apiBase ?? fileConfig.llm.apiBase ?? undefined,
    apiKey: selectedProvider?.apiKey ?? fileConfig.llm.apiKey ?? undefined,
    model: selectedProvider?.model ?? fileConfig.llm.model,
    visionModel: fileConfig.llm.visionModel,
    timeoutMs: fileConfig.llm.timeoutMs,
  };

  const apiBase =
    env.BER_LLM_API_BASE ||
    env.BER_HERMES_API_BASE ||
    env.OPENAI_BASE_URL ||
    fileLlm.apiBase ||
    undefined;

  const apiKeyRaw =
    env.BER_LLM_API_KEY ||
    env.BER_HERMES_API_KEY ||
    env.OPENAI_API_KEY ||
    fileLlm.apiKey ||
    undefined;

  return {
    host: env.BER_HOST || fileConfig.runtime.host,
    port: Number(env.BER_PORT || fileConfig.runtime.port),
    headless:
      env.BER_HEADLESS !== undefined
        ? env.BER_HEADLESS !== "0"
        : fileConfig.runtime.headless,
    dataDir: env.BER_DATA_DIR || fileConfig.runtime.dataDir,
    allowPurchase:
      env.BER_ALLOW_PURCHASE !== undefined
        ? env.BER_ALLOW_PURCHASE === "1"
        : fileConfig.runtime.allowPurchase,
    domains: env.BER_DOMAINS
      ? env.BER_DOMAINS.split(",").map((d) => d.trim()).filter(Boolean)
      : fileConfig.runtime.domains,
    llm: {
      apiBase: apiBase || undefined,
      apiKey: resolveSecret(apiKeyRaw, env),
      model:
        env.BER_LLM_MODEL ||
        env.BER_HERMES_MODEL ||
        env.OPENAI_MODEL ||
        fileLlm.model ||
        "llama3.2",
      visionModel:
        env.BER_COMPUTER_USE_MODEL ||
        env.BER_LLM_VISION_MODEL ||
        fileLlm.visionModel,
      timeoutMs: Number(
        env.BER_LLM_TIMEOUT_MS ||
          env.BER_HERMES_TIMEOUT_MS ||
          fileLlm.timeoutMs ||
          60_000,
      ),
    },
    configPath,
    configPlugins: loadConfigSitePlugins({
      cwd,
      configPath,
      inlinePlugins: fileConfig.plugins,
      pluginsFile:
        fileConfig.pluginsFile || env.BER_PLUGINS || env.BER_PLUGINS_FILE,
      env,
    }),
  };
}

function resolveSecret(
  value: string | null | undefined,
  env: NodeJS.ProcessEnv,
): string | undefined {
  if (!value) return undefined;
  if (value.startsWith("env:")) {
    const key = value.slice(4);
    return env[key] || undefined;
  }
  return value;
}
