import type { Action, SemanticState } from "../types.js";
import type { ProblemKind } from "../recovery/engine.js";
import { cookieConsentPlugin } from "./cookieConsent.js";
import { pluginMatches, type SitePlugin } from "./types.js";

export class PluginRegistry {
  private readonly plugins: SitePlugin[] = [];

  constructor(initial: SitePlugin[] = [cookieConsentPlugin]) {
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
}
