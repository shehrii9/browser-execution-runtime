import { PlanSchema, type Plan } from "../types.js";

export interface Planner {
  plan(intent: string): Promise<Plan | null>;
}

/**
 * Built-in deterministic planner for common intents.
 * Hermes/LLM planners should implement the Planner interface and be injected later.
 */
export class BuiltinPlanner implements Planner {
  async plan(intent: string): Promise<Plan | null> {
    const trimmed = intent.trim();

    const openMatch = trimmed.match(/^open\s+(https?:\/\/\S+)/i);
    if (openMatch) {
      return PlanSchema.parse({
        goal: trimmed,
        steps: [{ action: { type: "navigate", url: openMatch[1] } }],
      });
    }

    const searchMatch = trimmed.match(
      /^search\s+(.+?)\s+on\s+(https?:\/\/\S+|[\w.-]+\.[a-z]{2,})$/i,
    );
    if (searchMatch) {
      const query = searchMatch[1]!.trim();
      const siteRaw = searchMatch[2]!.trim();
      const url = siteRaw.startsWith("http") ? siteRaw : `https://${siteRaw}`;
      return PlanSchema.parse({
        goal: trimmed,
        steps: [
          { action: { type: "navigate", url } },
          { action: { type: "dismiss_overlays" }, optional: true },
          {
            action: {
              type: "type",
              target: { role: "searchbox" },
              text: query,
              pressEnter: true,
            },
          },
          { action: { type: "wait", ms: 1500 } },
        ],
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
  }): Promise<Plan | null>;
}

export class NoopComputerUseFallback implements ComputerUseFallback {
  async proposeFix(): Promise<Plan | null> {
    return null;
  }
}
