import { readFileSync } from "node:fs";
import type { ComputerUseFallback } from "../planner/engine.js";
import { LlmPlanner, resolveLlmEnv } from "../planner/llm.js";
import { PlanSchema, type Plan } from "../types.js";

export interface VisionComputerUseOptions {
  apiBase: string;
  /** Optional — local vision servers often need no key. */
  apiKey?: string;
  model: string;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}

/**
 * Computer-use style fallback for any OpenAI-compatible vision endpoint.
 * API key is optional.
 */
export class VisionComputerUseFallback implements ComputerUseFallback {
  private readonly fetchImpl: typeof fetch;

  constructor(private readonly options: VisionComputerUseOptions) {
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  async proposeFix(input: {
    intent: string;
    error: string;
    stateSummary: string[];
    screenshotPath?: string;
    url?: string;
  }): Promise<Plan | null> {
    if (!input.screenshotPath) return null;

    const image = readFileSync(input.screenshotPath).toString("base64");
    const prompt = [
      "You are a computer-use recovery helper for a browser runtime.",
      `Intent: ${input.intent}`,
      `URL: ${input.url ?? "unknown"}`,
      `Error: ${input.error}`,
      `State: ${input.stateSummary.join(" | ")}`,
      "Return ONLY a JSON plan with a few recovery steps (dismiss overlays, click close/accept, wait, alternate target).",
      "Schema: {\"goal\":string,\"steps\":[{\"action\":{...}}]}",
    ].join("\n");

    const base = this.options.apiBase.replace(/\/$/, "");
    const controller = new AbortController();
    const timer = setTimeout(
      () => controller.abort(),
      this.options.timeoutMs ?? 60_000,
    );
    try {
      const headers: Record<string, string> = {
        "content-type": "application/json",
      };
      if (this.options.apiKey) {
        headers.authorization = `Bearer ${this.options.apiKey}`;
      }

      const res = await this.fetchImpl(`${base}/chat/completions`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          model: this.options.model,
          temperature: 0,
          messages: [
            {
              role: "user",
              content: [
                { type: "text", text: prompt },
                {
                  type: "image_url",
                  image_url: {
                    url: `data:image/png;base64,${image}`,
                  },
                },
              ],
            },
          ],
        }),
        signal: controller.signal,
      });
      if (!res.ok) return null;
      const data = (await res.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      const content = data.choices?.[0]?.message?.content;
      if (!content) return null;
      return PlanSchema.parse(extractJson(content));
    } catch {
      return null;
    } finally {
      clearTimeout(timer);
    }
  }
}

export class CascadingComputerUseFallback implements ComputerUseFallback {
  constructor(private readonly chain: ComputerUseFallback[]) {}

  async proposeFix(input: {
    intent: string;
    error: string;
    stateSummary: string[];
    screenshotPath?: string;
    url?: string;
  }): Promise<Plan | null> {
    for (const item of this.chain) {
      const plan = await item.proposeFix(input);
      if (plan) return plan;
    }
    return null;
  }
}

export function createComputerUseFallbackFromEnv(
  env: NodeJS.ProcessEnv = process.env,
): ComputerUseFallback | null {
  const cfg = resolveLlmEnv(env);
  const apiBase =
    env.BER_COMPUTER_USE_API_BASE || cfg.apiBase;
  if (!apiBase) return null;

  const apiKey = env.BER_COMPUTER_USE_API_KEY || cfg.apiKey;
  const visionModel =
    env.BER_COMPUTER_USE_MODEL ||
    env.BER_LLM_VISION_MODEL ||
    env.BER_HERMES_VISION_MODEL ||
    cfg.model;

  const vision = new VisionComputerUseFallback({
    apiBase,
    apiKey,
    model: visionModel,
  });

  const text = new LlmPlanner({
    apiBase,
    apiKey,
    model: cfg.model,
  });

  const textFallback: ComputerUseFallback = {
    async proposeFix(input) {
      return text.plan(
        [
          `The browser runtime failed while pursuing: ${input.intent}`,
          `Error: ${input.error}`,
          `State: ${input.stateSummary.join(" | ")}`,
          "Propose a SHORT recovery plan only.",
        ].join("\n"),
      );
    },
  };

  return new CascadingComputerUseFallback([vision, textFallback]);
}

function extractJson(content: string): unknown {
  const trimmed = content.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const match = trimmed.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("No JSON object in fallback response");
    return JSON.parse(match[0]);
  }
}
