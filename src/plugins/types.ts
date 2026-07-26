import type { Action, SemanticState } from "../types.js";
import type { ProblemKind } from "../recovery/engine.js";

export interface SitePlugin {
  id: string;
  /** Domains this plugin applies to. Empty = universal. */
  domains: string[];
  /** Extra recovery recipes for classified problems. */
  recoveryFixes?: (problem: ProblemKind, state: SemanticState) => Action[][];
  /** Optional workflow snippets Hermes/planner can reuse later. */
  workflows?: Record<string, Action[]>;
}

export function pluginMatches(plugin: SitePlugin, domain: string): boolean {
  if (plugin.domains.length === 0) return true;
  return plugin.domains.some(
    (d) => domain === d || domain.endsWith(`.${d}`),
  );
}
