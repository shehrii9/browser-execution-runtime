import type { Action, SemanticState } from "../types.js";
import type { ProblemKind } from "../recovery/engine.js";
import { amazonPlugin } from "./amazon.js";
import { authModalPlugin } from "./authModal.js";
import { cookieConsentPlugin } from "./cookieConsent.js";
import { githubPlugin } from "./github.js";
import { googlePlugin } from "./google.js";
import { mediaSitesPlugin } from "./mediaSites.js";
import { contentSitesPlugin } from "./contentSites.js";
import { pluginMatches, type SitePlugin } from "./types.js";

export const DEFAULT_PLUGINS: SitePlugin[] = [
  cookieConsentPlugin,
  authModalPlugin,
  githubPlugin,
  googlePlugin,
  amazonPlugin,
  mediaSitesPlugin,
  contentSitesPlugin,
];

export function createPluginRegistry(extra: SitePlugin[] = []): PluginRegistry {
  return new PluginRegistry([...DEFAULT_PLUGINS, ...extra]);
}

export class PluginRegistry {
  private readonly plugins: SitePlugin[] = [];

  constructor(initial: SitePlugin[] = DEFAULT_PLUGINS) {
    for (const plugin of initial) this.register(plugin);
  }

  register(plugin: SitePlugin): void {
    this.plugins.push(plugin);
  }

  list(): SitePlugin[] {
    return [...this.plugins];
  }

  forDomain(domain: string): SitePlugin[] {
    return this.plugins.filter((p) => pluginMatches(p, domain));
  }

  recoveryFixes(problem: ProblemKind, state: SemanticState): Action[][] {
    const out: Action[][] = [];
    for (const plugin of this.forDomain(state.domain)) {
      const fixes = plugin.recoveryFixes?.(problem, state) ?? [];
      out.push(...fixes);
    }
    return out;
  }

  workflowsFor(domain: string): Record<string, Action[]> {
    const merged: Record<string, Action[]> = {};
    for (const plugin of this.forDomain(domain)) {
      Object.assign(merged, plugin.workflows ?? {});
    }
    return merged;
  }
}
