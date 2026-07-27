import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { z } from "zod";
import type { ProblemKind } from "../recovery/engine.js";
import { ActionSchema, type Action } from "../types.js";
import type { SitePlugin } from "./types.js";

const ProblemKindSchema = z.enum([
  "cookie_banner",
  "dialog_blocking",
  "auth_required",
  "otp_required",
  "payment_confirm",
  "target_not_found",
  "navigation_timeout",
  "unknown",
]);

export const ConfigPluginSchema = z.object({
  id: z.string().min(1),
  domains: z.array(z.string()).default([]),
  workflows: z.record(z.string(), z.array(ActionSchema)).optional(),
  recovery: z.record(z.string(), z.array(z.array(ActionSchema))).optional(),
});

export type ConfigPluginSpec = z.infer<typeof ConfigPluginSchema>;

const PluginsFileSchema = z.union([
  z.object({ plugins: z.array(ConfigPluginSchema) }),
  z.array(ConfigPluginSchema),
]);

export function sitePluginFromConfig(spec: ConfigPluginSpec): SitePlugin {
  const recoveryMap = parseRecoveryMap(spec.recovery);
  return {
    id: spec.id,
    domains: spec.domains,
    workflows: spec.workflows,
    recoveryFixes: recoveryMap
      ? (problem) => recoveryMap.get(problem) ?? []
      : undefined,
  };
}

function parseRecoveryMap(
  raw: ConfigPluginSpec["recovery"],
): Map<ProblemKind, Action[][]> | null {
  if (!raw || Object.keys(raw).length === 0) return null;
  const map = new Map<ProblemKind, Action[][]>();
  for (const [key, fixes] of Object.entries(raw)) {
    const problem = ProblemKindSchema.parse(key);
    map.set(
      problem,
      fixes.map((seq) => seq.map((action) => ActionSchema.parse(action))),
    );
  }
  return map;
}

export function parseConfigPluginSpecs(raw: unknown): ConfigPluginSpec[] {
  if (!raw) return [];
  if (Array.isArray(raw)) {
    return raw.map((item) => ConfigPluginSchema.parse(item));
  }
  return [];
}

export function loadPluginsFile(absPath: string): ConfigPluginSpec[] {
  const parsed = JSON.parse(readFileSync(absPath, "utf8")) as unknown;
  const data = PluginsFileSchema.parse(parsed);
  return Array.isArray(data) ? data.map((p) => ConfigPluginSchema.parse(p)) : data.plugins;
}

export interface LoadConfigPluginsOptions {
  cwd?: string;
  configPath?: string;
  inlinePlugins?: unknown;
  pluginsFile?: string;
  env?: NodeJS.ProcessEnv;
}

/** Load declarative site plugins from config + optional BER_PLUGINS file. */
export function loadConfigSitePlugins(options: LoadConfigPluginsOptions = {}): SitePlugin[] {
  const env = options.env ?? process.env;
  const cwd = options.cwd ?? process.cwd();
  const specs: ConfigPluginSpec[] = [];

  specs.push(...parseConfigPluginSpecs(options.inlinePlugins));

  const pluginsFile =
    options.pluginsFile ||
    env.BER_PLUGINS ||
    env.BER_PLUGINS_FILE;
  if (pluginsFile) {
    const base = options.configPath ? dirname(options.configPath) : cwd;
    const abs = resolve(base, pluginsFile);
    if (!existsSync(abs)) {
      throw new Error(`Plugins file not found: ${abs}`);
    }
    specs.push(...loadPluginsFile(abs));
  }

  const seen = new Set<string>();
  const plugins: SitePlugin[] = [];
  for (const spec of specs) {
    if (seen.has(spec.id)) {
      throw new Error(`Duplicate config plugin id: ${spec.id}`);
    }
    seen.add(spec.id);
    plugins.push(sitePluginFromConfig(spec));
  }
  return plugins;
}
