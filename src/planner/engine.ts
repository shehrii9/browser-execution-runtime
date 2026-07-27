import { PlanSchema, type Plan } from "../types.js";
import { isMediaHost } from "../state/fingerprint.js";
import { PluginRegistry } from "../plugins/registry.js";

export interface Planner {
  plan(intent: string): Promise<Plan | null>;
}

const MEDIA_HOME: Record<string, string> = {
  youtube: "www.youtube.com",
  vimeo: "vimeo.com",
  twitch: "www.twitch.tv",
  dailymotion: "www.dailymotion.com",
  rumble: "rumble.com",
  soundcloud: "soundcloud.com",
  spotify: "open.spotify.com",
  tiktok: "www.tiktok.com",
};

/**
 * Built-in deterministic planner for common intents.
 * Optional PluginRegistry supplies site workflows (media sites, Google, …).
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

    const openMedia = trimmed.match(
      /^open\s+(youtube|vimeo|twitch|dailymotion|rumble|soundcloud|spotify|tiktok)$/i,
    );
    if (openMedia) {
      const key = openMedia[1]!.toLowerCase();
      const domain = MEDIA_HOME[key]!;
      const workflows = this.plugins.workflowsFor(domain);
      const named = workflows[`open_${key}`] ?? workflows.open_home;
      if (named?.length) {
        return PlanSchema.parse({
          goal: trimmed,
          steps: named.map((action) => ({ action })),
        });
      }
      return PlanSchema.parse({
        goal: trimmed,
        steps: [
          { action: { type: "navigate", url: `https://${domain}` } },
          { action: { type: "wait", settle: true }, optional: true },
          { action: { type: "dismiss_overlays" }, optional: true },
        ],
      });
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
      const media = isMediaHost(domain);
      const prefix = this.plugins.workflowsFor(domain).search;

      const steps = [
        ...(prefix?.length
          ? [
              { action: { type: "navigate" as const, url } },
              ...prefix.map((action) => ({ action })),
            ]
          : [
              { action: { type: "navigate" as const, url } },
              { action: { type: "dismiss_overlays" as const }, optional: true },
            ]),
        {
          action: {
            type: "type" as const,
            target: media
              ? {
                  css: "input#search, input[name='search_query'], input[type='search'], input[placeholder*='Search' i]",
                }
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
