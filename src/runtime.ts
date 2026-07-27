import { resolve } from "node:path";
import { BrowserSession, type AttachOptions } from "./browser/session.js";
import { ExperienceStore } from "./experience/store.js";
import { PlanRunner } from "./executor/plan-runner.js";
import { ActionExecutor } from "./executor/actions.js";
import { createEmbedderFromEnv, type Embedder } from "./memory/embedder.js";
import { SessionMemory } from "./memory/hierarchy.js";
import { PluginRegistry } from "./plugins/registry.js";
import {
  BuiltinPlanner,
  NoopComputerUseFallback,
  type ComputerUseFallback,
  type Planner,
} from "./planner/engine.js";
import { createPolicy, looksLikePurchaseIntent } from "./policy.js";
import { observePage } from "./state/observe.js";
import { diffStates } from "./state/diff.js";
import { MetricsCollector } from "./telemetry/metrics.js";
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
  planner?: Planner;
  computerUseFallback?: ComputerUseFallback;
  plugins?: PluginRegistry;
  embedder?: Embedder;
}

export class BrowserRuntime {
  private readonly policy: Policy;
  private readonly session: BrowserSession;
  private readonly experiences: ExperienceStore;
  private readonly sessionMemory = new SessionMemory();
  private readonly metrics = new MetricsCollector();
  private readonly planner: Planner;
  private readonly computerUseFallback: ComputerUseFallback;
  private readonly plugins: PluginRegistry;
  private readonly dataDir: string;
  private lastPlan?: Plan;
  private lastResult?: RunResult;

  constructor(options: RuntimeOptions = {}) {
    this.policy = createPolicy(options.policy ?? {});
    this.session = new BrowserSession(this.policy);
    this.dataDir = resolve(options.dataDir ?? "data");
    this.experiences = new ExperienceStore(
      resolve(this.dataDir, "experiences.db"),
      options.embedder ?? createEmbedderFromEnv(),
    );
    this.planner = options.planner ?? new BuiltinPlanner();
    this.computerUseFallback =
      options.computerUseFallback ?? new NoopComputerUseFallback();
    this.plugins = options.plugins ?? new PluginRegistry();
  }

  async attach(options: AttachOptions = {}): Promise<SemanticState> {
    await this.session.attach(options);
    const state = await observePage(this.session.getPage());
    this.sessionMemory.setState(state);
    return state;
  }

  async observe(): Promise<SemanticState> {
    this.ensureAttached();
    const state = await observePage(this.session.getPage());
    this.sessionMemory.setState(state);
    return state;
  }

  async diff(): Promise<{ state: SemanticState; diff: StateDiff }> {
    const before = this.sessionMemory.getState();
    const state = await this.observe();
    return { state, diff: diffStates(before, state) };
  }

  async act(action: Action) {
    this.ensureAttached();
    const executor = new ActionExecutor(this.session, this.policy);
    const result = await executor.execute(action);
    this.sessionMemory.pushAction(action.type);
    const state = await this.observe();
    return { ...result, state };
  }

  async listTabs() {
    this.ensureAttached();
    return this.session.listTabs();
  }

  async newTab(url?: string) {
    this.ensureAttached();
    const tab = await this.session.newTab(url);
    await this.observe();
    return tab;
  }

  async switchTab(index: number) {
    this.ensureAttached();
    const tab = await this.session.switchTab(index);
    await this.observe();
    return tab;
  }

  async closeTab(index?: number) {
    this.ensureAttached();
    const tabs = await this.session.closeTab(index);
    await this.observe();
    return tabs;
  }

  async run(
    planInput: Plan | unknown,
    options: { resumeFromStep?: number } = {},
  ): Promise<RunResult> {
    this.ensureAttached();
    const plan = PlanSchema.parse(planInput);
    if (!this.policy.allowPurchase && looksLikePurchaseIntent(plan.goal)) {
      throw new Error(`Purchase-like goal blocked by policy: "${plan.goal}"`);
    }

    this.lastPlan = plan;
    const runner = new PlanRunner(
      this.session,
      this.policy,
      this.experiences,
      this.plugins,
    );
    let result = await runner.run(plan, {
      resumeFromStep: options.resumeFromStep,
      screenshotDir: resolve(this.dataDir, "screenshots"),
      metrics: this.metrics,
    });

    if (!result.ok && result.error && result.resumeFromStep !== undefined) {
      const fixPlan = await this.computerUseFallback.proposeFix({
        intent: plan.goal,
        error: result.error,
        stateSummary: result.finalState
          ? [
              result.finalState.url,
              result.finalState.pageHint,
              ...result.finalState.signals,
            ]
          : [],
        screenshotPath: result.screenshotPath,
        url: result.finalState?.url,
      });
      if (fixPlan) {
        const fixResult = await runner.run(fixPlan, {
          screenshotDir: resolve(this.dataDir, "screenshots"),
          metrics: this.metrics,
        });
        if (fixResult.ok) {
          if (fixResult.steps[0]) {
            await this.experiences.remember({
              site: result.finalState?.domain ?? "unknown",
              goal: plan.goal,
              stateHash: result.finalState?.fingerprint ?? "unknown",
              problem: "computer_use_fallback",
              fix: fixResult.steps.map((s) => s.action),
              success: true,
              pageHint: result.finalState?.pageHint,
              signals: result.finalState?.signals,
            });
          }
          result = await runner.run(plan, {
            resumeFromStep: result.resumeFromStep,
            screenshotDir: resolve(this.dataDir, "screenshots"),
            metrics: this.metrics,
          });
        }
      }
    }

    if (result.finalState) this.sessionMemory.setState(result.finalState);
    this.sessionMemory.saveCheckpoint("last_run", result);
    this.lastResult = result;
    return result;
  }

  async resume(): Promise<RunResult> {
    if (!this.lastPlan || !this.lastResult || this.lastResult.resumeFromStep === undefined) {
      throw new Error("No failed run available to resume.");
    }
    return this.run(this.lastPlan, {
      resumeFromStep: this.lastResult.resumeFromStep,
    });
  }

  async execute(intent: string): Promise<RunResult> {
    const plan = await this.planner.plan(intent);
    if (!plan) {
      throw new Error(
        `No planner match for intent. Provide an explicit plan via run(), or set BER_LLM_API_BASE / inject a Planner. Intent: ${intent}`,
      );
    }
    return this.run(plan);
  }

  async remember(input: {
    site: string;
    goal: string;
    stateHash: string;
    problem: string;
    fix: Action[];
    pageHint?: string;
    signals?: string[];
  }) {
    return this.experiences.remember(input);
  }

  listExperiences(limit = 50) {
    return this.experiences.list(limit);
  }

  listPlugins() {
    return this.plugins.list().map((p) => p.id);
  }

  metricsSnapshot() {
    return this.metrics.snapshot();
  }

  async status(): Promise<RuntimeStatus> {
    const state = this.sessionMemory.getState();
    return {
      attached: this.session.isAttached(),
      url: state?.url,
      title: state?.title,
      policy: this.policy,
      experienceCount: this.experiences.count(),
      memory: {
        l1SessionCached: Boolean(state),
        l2ExperienceCount: this.experiences.count(),
        l3VectorIndex: this.experiences.embedderId(),
        l3VectorCount: this.experiences.vectorCount(),
        engine: "typescript+sqlite",
      },
      tabs: this.session.isAttached() ? await this.session.listTabs() : [],
      plugins: this.listPlugins(),
    };
  }

  setPolicy(partial: Partial<Policy>): Policy {
    Object.assign(this.policy, createPolicy({ ...this.policy, ...partial }));
    return this.policy;
  }

  async close(): Promise<void> {
    await this.session.close();
    this.experiences.close();
    this.sessionMemory.clear();
  }

  private ensureAttached(): void {
    if (!this.session.isAttached()) {
      throw new Error("Runtime is not attached to a browser. Call attach() first.");
    }
  }
}
