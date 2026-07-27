import { PlanSchema, type Plan } from "../types.js";
import { PluginRegistry } from "../plugins/registry.js";

export interface Planner {
  plan(intent: string): Promise<Plan | null>;
}

/**
 * Built-in deterministic planner for common intents.
 * Optional PluginRegistry supplies site workflows (YouTube, Google, …).
 */
export class BuiltinPlanner implements Planner {
  constructor(private readonly plugins: PluginRegistry = new PluginRegistry()) {}

  async plan(intent: string): Promise<Plan | null> {
    const trimmed = intent.trim();

    const openMatch = trimmed.match(/^open\s+(https?:\/\/\S+)/i);
    if (openMatch) {
      return PlanSchema.parse({
        goal: trimmed,
        steps: [
          { action: { type: "navigate", url: openMatch[1] } },
          { action: { type: "wait", settle: true }, optional: true },
          { action: { type: "dismiss_overlays" }, optional: true },
        ],
      });
    }

    if (/^open\s+youtube$/i.test(trimmed)) {
      const steps = this.plugins.workflowsFor("www.youtube.com").open_home;
      if (steps?.length) {
        return PlanSchema.parse({
          goal: trimmed,
          steps: steps.map((action) => ({ action })),
        });
      }
    }

    const workflowMatch = trimmed.match(
      /^run\s+([\w-]+)\s+on\s+(https?:\/\/\S+|[\w.-]+\.[a-z]{2,})$/i,
    );
    if (workflowMatch) {
      const name = workflowMatch[1]!.trim();
      const siteRaw = workflowMatch[2]!.trim();
      const domain = siteRaw.startsWith("http")
        ? new URL(siteRaw).hostname
        : siteRaw;
      const workflows = this.plugins.workflowsFor(domain);
      const steps = workflows[name];
      if (steps?.length) {
        return PlanSchema.parse({
          goal: trimmed,
          steps: steps.map((action) => ({ action })),
          metadata: { workflow: name, domain },
        });
      }
    }

    const searchMatch = trimmed.match(
      /^search\s+(.+?)\s+on\s+(https?:\/\/\S+|[\w.-]+\.[a-z]{2,})$/i,
    );
    if (searchMatch) {
      const query = searchMatch[1]!.trim();
      const siteRaw = searchMatch[2]!.trim();
      const url = siteRaw.startsWith("http") ? siteRaw : `https://${siteRaw}`;
      const domain = new URL(url).hostname;
      const isYoutube = /youtube\.com|youtu\.be/i.test(domain);
      const prefix = this.plugins.workflowsFor(domain).search;

      const steps = [
        ...(prefix?.length
          ? prefix.map((action) => ({ action }))
          : [
              { action: { type: "navigate" as const, url } },
              { action: { type: "dismiss_overlays" as const }, optional: true },
            ]),
        {
          action: {
            type: "type" as const,
            target: isYoutube
              ? { css: "input#search, input[name='search_query']" }
              : { role: "searchbox" },
            text: query,
            pressEnter: true,
          },
        },
        { action: { type: "wait", settle: true, timeoutMs: 6000 } },
      ];

      return PlanSchema.parse({
        goal: trimmed,
        steps,
      });
    }

    return null;
  }
}

/**
 * Optional fallback: when structured execution fails hard, an external
 * computer-use / vision agent can be asked for a short fix plan.
 */
export interface ComputerUseFallback {
  proposeFix(input: {
    intent: string;
    error: string;
    stateSummary: string[];
    screenshotPath?: string;
    url?: string;
  }): Promise<Plan | null>;
}

export class NoopComputerUseFallback implements ComputerUseFallback {
  async proposeFix(): Promise<Plan | null> {
    return null;
  }
}
