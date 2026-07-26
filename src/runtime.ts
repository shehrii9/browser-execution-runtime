import { resolve } from "node:path";
import { BrowserSession, type AttachOptions } from "./browser/session.js";
import { ExperienceStore } from "./experience/store.js";
import { PlanRunner } from "./executor/plan-runner.js";
import { ActionExecutor } from "./executor/actions.js";
import { createPolicy, looksLikePurchaseIntent } from "./policy.js";
import { observePage } from "./state/observe.js";
import { diffStates } from "./state/diff.js";
import {
  PlanSchema,
  type Action,
  type Plan,
  type Policy,
  type RunResult,
  type RuntimeStatus,
  type SemanticState,
  type StateDiff,
} from "./types.js";

export interface RuntimeOptions {
  dataDir?: string;
  policy?: Partial<Policy>;
}

export class BrowserRuntime {
  private readonly policy: Policy;
  private readonly session: BrowserSession;
  private readonly experiences: ExperienceStore;
  private lastState?: SemanticState;

  constructor(options: RuntimeOptions = {}) {
    this.policy = createPolicy(options.policy ?? {});
    this.session = new BrowserSession(this.policy);
    const dataDir = resolve(options.dataDir ?? "data");
    this.experiences = new ExperienceStore(resolve(dataDir, "experiences.db"));
  }

  async attach(options: AttachOptions = {}): Promise<SemanticState> {
    await this.session.attach(options);
    this.lastState = await observePage(this.session.getPage());
    return this.lastState;
  }

  async observe(): Promise<SemanticState> {
    this.ensureAttached();
    this.lastState = await observePage(this.session.getPage());
    return this.lastState;
  }

  async diff(): Promise<{ state: SemanticState; diff: StateDiff }> {
    const before = this.lastState;
    const state = await this.observe();
    return { state, diff: diffStates(before, state) };
  }

  async act(action: Action) {
    this.ensureAttached();
    const executor = new ActionExecutor(this.session.getPage(), this.policy);
    const result = await executor.execute(action);
    const state = await this.observe();
    return { ...result, state };
  }

  async run(planInput: Plan | unknown): Promise<RunResult> {
    this.ensureAttached();
    const plan = PlanSchema.parse(planInput);
    if (!this.policy.allowPurchase && looksLikePurchaseIntent(plan.goal)) {
      throw new Error(`Purchase-like goal blocked by policy: "${plan.goal}"`);
    }
    const runner = new PlanRunner(
      this.session.getPage(),
      this.policy,
      this.experiences,
    );
    const result = await runner.run(plan);
    this.lastState = result.finalState;
    return result;
  }

  /**
   * Lightweight intent helper for Hermes.
   * Without an external planner model wired in, this supports a few common intents
   * and otherwise asks the caller to provide an explicit plan.
   */
  async execute(intent: string): Promise<RunResult> {
    const plan = intentToPlan(intent);
    if (!plan) {
      throw new Error(
        `No built-in planner match for intent. Provide an explicit plan via run(). Intent: ${intent}`,
      );
    }
    return this.run(plan);
  }

  remember(input: {
    site: string;
    goal: string;
    stateHash: string;
    problem: string;
    fix: Action[];
  }) {
    return this.experiences.remember(input);
  }

  listExperiences(limit = 50) {
    return this.experiences.list(limit);
  }

  status(): RuntimeStatus {
    return {
      attached: this.session.isAttached(),
      url: this.lastState?.url,
      title: this.lastState?.title,
      policy: this.policy,
      experienceCount: this.experiences.count(),
    };
  }

  setPolicy(partial: Partial<Policy>): Policy {
    Object.assign(this.policy, createPolicy({ ...this.policy, ...partial }));
    return this.policy;
  }

  async close(): Promise<void> {
    await this.session.close();
    this.experiences.close();
  }

  private ensureAttached(): void {
    if (!this.session.isAttached()) {
      throw new Error("Runtime is not attached to a browser. Call attach() first.");
    }
  }
}

function intentToPlan(intent: string): Plan | null {
  const trimmed = intent.trim();

  const openMatch = trimmed.match(/^open\s+(https?:\/\/\S+)/i);
  if (openMatch) {
    return {
      goal: trimmed,
      steps: [{ action: { type: "navigate", url: openMatch[1]! } }],
    };
  }

  const searchMatch = trimmed.match(/^search\s+(.+?)\s+on\s+(https?:\/\/\S+|[\w.-]+\.[a-z]{2,})$/i);
  if (searchMatch) {
    const query = searchMatch[1]!.trim();
    const siteRaw = searchMatch[2]!.trim();
    const url = siteRaw.startsWith("http") ? siteRaw : `https://${siteRaw}`;
    return {
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
    };
  }

  return null;
}
