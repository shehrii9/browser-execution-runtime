import { PlanSchema, type Plan } from "../types.js";
import type { ComputerUseFallback, Planner } from "./engine.js";
import { BuiltinPlanner } from "./engine.js";

export interface HermesPlannerOptions {
  apiBase: string;
  apiKey?: string;
  model: string;
  timeoutMs?: number;
  /** Fall back to BuiltinPlanner when Hermes returns nothing usable. */
  fallback?: Planner;
  fetchImpl?: typeof fetch;
}

const PLANNER_SYSTEM = `You are the planner for a browser execution runtime.
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
        | {"type":"wait","ms"?:number,"urlIncludes"?:string,"text"?:string,"target"?: Target}
        | {"type":"scroll","direction"?: "up"|"down","amount"?: number}
        | {"type":"extract","target"?: Target,"attribute"?:string,"key"?:string}
        | {"type":"press","key":string}
        | {"type":"dismiss_overlays"}
        | {"type":"observe"},
      "expect"?: {"urlIncludes"?:string,"text"?:string,"target"?: Target}
    }
  ]
}
Target = {"role"?:string,"name"?:string,"text"?:string,"placeholder"?:string,"css"?:string,"testId"?:string,"nth"?:number}

Rules:
- Prefer role/name/text targets over brittle CSS.
- Plan once with enough steps; do not narrate.
- Include dismiss_overlays after navigations when popups are likely.
- Never include payment/purchase confirmation unless explicitly required.
- Output JSON only. No markdown.`;

export class HermesPlanner implements Planner {
  private readonly fallback: Planner;
  private readonly fetchImpl: typeof fetch;

  constructor(private readonly options: HermesPlannerOptions) {
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
      const res = await this.fetchImpl(`${base}/chat/completions`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(this.options.apiKey
            ? { authorization: `Bearer ${this.options.apiKey}` }
            : {}),
        },
        body: JSON.stringify({
          model: this.options.model,
          temperature: 0.1,
          messages,
        }),
        signal: controller.signal,
      });
      if (!res.ok) {
        throw new Error(`Hermes planner HTTP ${res.status}: ${await res.text()}`);
      }
      const data = (await res.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      const content = data.choices?.[0]?.message?.content;
      if (!content) throw new Error("Hermes planner returned empty content");
      return content;
    } finally {
      clearTimeout(timer);
    }
  }
}

export class HermesComputerUseFallback implements ComputerUseFallback {
  constructor(private readonly planner: HermesPlanner) {}

  async proposeFix(input: {
    intent: string;
    error: string;
    stateSummary: string[];
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

export function createHermesPlannerFromEnv(
  env: NodeJS.ProcessEnv = process.env,
): HermesPlanner | null {
  const apiBase = env.BER_HERMES_API_BASE || env.OPENAI_BASE_URL;
  if (!apiBase) return null;
  return new HermesPlanner({
    apiBase,
    apiKey: env.BER_HERMES_API_KEY || env.OPENAI_API_KEY,
    model: env.BER_HERMES_MODEL || env.OPENAI_MODEL || "hermes",
    timeoutMs: Number(env.BER_HERMES_TIMEOUT_MS ?? 60_000),
  });
}

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
