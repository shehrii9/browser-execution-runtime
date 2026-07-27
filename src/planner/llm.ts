import { PlanSchema, type Plan } from "../types.js";
import type { ComputerUseFallback, Planner } from "./engine.js";
import { BuiltinPlanner } from "./engine.js";

export interface LlmPlannerOptions {
  apiBase: string;
  /** Optional. Local/open providers often need no key. */
  apiKey?: string;
  model: string;
  timeoutMs?: number;
  fallback?: Planner;
  fetchImpl?: typeof fetch;
}

const PLANNER_SYSTEM = `You are the planner for an open browser execution runtime.
Convert the user intent into a compact JSON plan the runtime can execute deterministically.
Return ONLY valid JSON matching this schema:
{
  "goal": string,
  "steps": [
    {
      "id"?: string,
      "optional"?: boolean,
      "action":
        | {"type":"navigate","url":string,"waitUntil"?: "load"|"domcontentloaded"|"networkidle"}
        | {"type":"click","target": Target}
        | {"type":"type","target": Target,"text":string,"clear"?:boolean,"pressEnter"?:boolean}
        | {"type":"select","target": Target,"value":string}
        | {"type":"wait","ms"?:number,"urlIncludes"?:string,"text"?:string,"target"?: Target,"settle"?:boolean,"networkIdle"?:boolean,"timeoutMs"?:number}
        | {"type":"scroll","direction"?: "up"|"down","amount"?: number,"settle"?:boolean,"untilText"?:string,"untilCss"?:string,"untilCountAtLeast"?:number,"maxScrolls"?:number,"timeoutMs"?:number}
        | {"type":"extract","target"?: Target,"attribute"?:string,"key"?:string}
        | {"type":"press","key":string}
        | {"type":"dismiss_overlays"}
        | {"type":"media","command":"play"|"pause"|"toggle"|"mute"|"unmute"|"skip_ad"|"fullscreen"}
        | {"type":"observe"}
        | {"type":"new_tab","url"?:string}
        | {"type":"switch_tab","index":number}
        | {"type":"close_tab","index"?:number},
      "expect"?: {"urlIncludes"?:string,"text"?:string,"target"?: Target}
    }
  ]
}
Target = {"role"?:string,"name"?:string,"text"?:string,"placeholder"?:string,"css"?:string,"testId"?:string,"nth"?:number,"frame"?:string,"frameUrl"?:string}

Rules:
- Prefer role/name/text targets over brittle CSS.
- Plan once with enough steps; do not narrate.
- Include dismiss_overlays after navigations when popups are likely.
- On SPAs / media sites, use {"type":"wait","settle":true} after navigate/click.
- For infinite scroll feeds use scroll with untilCss/untilText/untilCountAtLeast.
- For video/audio pages prefer {"type":"media","command":"play"|"skip_ad"} over screenshot clicks.
- Never include payment/purchase confirmation unless explicitly required.
- Output JSON only. No markdown.`;

/**
 * Provider-agnostic planner for any OpenAI-compatible chat API
 * (Ollama, vLLM, OpenAI, Anthropic gateways, Hermes, local servers, etc.).
 * API key is optional.
 */
export class LlmPlanner implements Planner {
  private readonly fallback: Planner;
  private readonly fetchImpl: typeof fetch;

  constructor(private readonly options: LlmPlannerOptions) {
    this.fallback = options.fallback ?? new BuiltinPlanner();
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  async plan(intent: string): Promise<Plan | null> {
    try {
      const content = await this.chat([
        { role: "system", content: PLANNER_SYSTEM },
        { role: "user", content: intent },
      ]);
      const parsed = extractJson(content);
      return PlanSchema.parse(parsed);
    } catch {
      return this.fallback.plan(intent);
    }
  }

  private async chat(
    messages: Array<{ role: string; content: string }>,
  ): Promise<string> {
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
          temperature: 0.1,
          messages,
        }),
        signal: controller.signal,
      });
      if (!res.ok) {
        throw new Error(`LLM planner HTTP ${res.status}: ${await res.text()}`);
      }
      const data = (await res.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      const content = data.choices?.[0]?.message?.content;
      if (!content) throw new Error("LLM planner returned empty content");
      return content;
    } finally {
      clearTimeout(timer);
    }
  }
}

export class LlmComputerUseFallback implements ComputerUseFallback {
  constructor(private readonly planner: LlmPlanner) {}

  async proposeFix(input: {
    intent: string;
    error: string;
    stateSummary: string[];
    screenshotPath?: string;
    url?: string;
  }): Promise<Plan | null> {
    const prompt = [
      `The browser runtime failed while pursuing: ${input.intent}`,
      `Error: ${input.error}`,
      `State: ${input.stateSummary.join(" | ")}`,
      "Propose a SHORT recovery plan only (dismiss overlays, wait, alternate click/type targets, refresh via navigate to current URL if needed).",
    ].join("\n");
    return this.planner.plan(prompt);
  }
}

/** Resolve planner settings from env. No API key required. */
export function resolveLlmEnv(env: NodeJS.ProcessEnv = process.env): {
  apiBase?: string;
  apiKey?: string;
  model: string;
  timeoutMs: number;
} {
  return {
    apiBase:
      env.BER_LLM_API_BASE ||
      env.BER_HERMES_API_BASE ||
      env.OPENAI_BASE_URL ||
      undefined,
    apiKey:
      env.BER_LLM_API_KEY ||
      env.BER_HERMES_API_KEY ||
      env.OPENAI_API_KEY ||
      undefined,
    model:
      env.BER_LLM_MODEL ||
      env.BER_HERMES_MODEL ||
      env.OPENAI_MODEL ||
      "llama3.2",
    timeoutMs: Number(env.BER_LLM_TIMEOUT_MS ?? env.BER_HERMES_TIMEOUT_MS ?? 60_000),
  };
}

export function createLlmPlannerFromEnv(
  env: NodeJS.ProcessEnv = process.env,
): LlmPlanner | null {
  const cfg = resolveLlmEnv(env);
  if (!cfg.apiBase) return null;
  return new LlmPlanner({
    apiBase: cfg.apiBase,
    apiKey: cfg.apiKey,
    model: cfg.model,
    timeoutMs: cfg.timeoutMs,
  });
}

// Backward-compatible aliases (Hermes is one possible provider, not a hard dependency).
export type HermesPlannerOptions = LlmPlannerOptions;
export const HermesPlanner = LlmPlanner;
export const HermesComputerUseFallback = LlmComputerUseFallback;
export const createHermesPlannerFromEnv = createLlmPlannerFromEnv;

function extractJson(content: string): unknown {
  const trimmed = content.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const match = trimmed.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("No JSON object in planner response");
    return JSON.parse(match[0]);
  }
}
