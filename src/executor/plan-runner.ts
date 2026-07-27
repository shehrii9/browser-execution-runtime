import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { ExperienceStore } from "../experience/store.js";
import { PluginRegistry } from "../plugins/registry.js";
import { classifyProblem, heuristicFixes } from "../recovery/engine.js";
import { diffStates } from "../state/diff.js";
import { observePage } from "../state/observe.js";
import { MetricsCollector } from "../telemetry/metrics.js";
import type {
  Action,
  Plan,
  Policy,
  RunResult,
  SemanticState,
  StepResult,
} from "../types.js";
import { ActionExecutor, type TabController } from "./actions.js";
import { SelectorEngine } from "../selectors/engine.js";

export interface PlanRunnerOptions {
  resumeFromStep?: number;
  screenshotDir?: string;
  metrics?: MetricsCollector;
}

export class PlanRunner {
  constructor(
    private readonly tabs: TabController,
    private readonly policy: Policy,
    private readonly experiences: ExperienceStore,
    private readonly plugins: PluginRegistry = new PluginRegistry(),
  ) {}

  async run(plan: Plan, options: PlanRunnerOptions = {}): Promise<RunResult> {
    const executor = new ActionExecutor(this.tabs, this.policy);
    const metrics = options.metrics ?? new MetricsCollector();
    metrics.start();

    const steps: StepResult[] = [];
    let previousState: SemanticState | undefined;
    let llmCallsAvoided = 0;
    let currentState = await observePage(this.tabs.getPage());
    previousState = currentState;

    const startIndex = Math.max(0, options.resumeFromStep ?? 0);
    const limitedSteps = plan.steps.slice(0, this.policy.maxSteps);

    for (let index = startIndex; index < limitedSteps.length; index++) {
      const step = limitedSteps[index]!;
      const selectors = new SelectorEngine(this.tabs.getPage());
      let result = await executor.execute(step.action);
      let recovered = false;
      let experienceApplied: number | undefined;

      if (!result.ok) {
        const recovery = await this.recover({
          executor,
          goal: plan.goal,
          error: result.error ?? "unknown error",
          state: currentState,
        });
        llmCallsAvoided += recovery.llmCallsAvoided;
        metrics.addLlmCallsAvoided(recovery.llmCallsAvoided);
        recovered = recovery.recovered;
        experienceApplied = recovery.experienceId;

        if (recovery.recovered) {
          result = await executor.execute(step.action);
        }
      }

      currentState = await observePage(this.tabs.getPage());
      const diff = diffStates(previousState, currentState);

      if (result.ok && step.expect) {
        const expectOk = await this.checkExpect(
          step.expect,
          selectors,
          currentState,
        );
        if (!expectOk) {
          // Late SPA updates often fail the first expect — settle + one recovery pass.
          await this.tabs.getPage().waitForTimeout(400).catch(() => undefined);
          const recovery = await this.recover({
            executor,
            goal: plan.goal,
            error: `Expectation failed after action ${step.action.type}`,
            state: currentState,
          });
          llmCallsAvoided += recovery.llmCallsAvoided;
          metrics.addLlmCallsAvoided(recovery.llmCallsAvoided);
          if (recovery.recovered) {
            recovered = true;
            experienceApplied = recovery.experienceId;
            currentState = await observePage(this.tabs.getPage());
            const retryExpect = await this.checkExpect(
              step.expect,
              new SelectorEngine(this.tabs.getPage()),
              currentState,
            );
            if (retryExpect) {
              result = { ok: true, extracted: result.extracted };
            } else {
              result = {
                ok: false,
                error: `Expectation failed after action ${step.action.type}`,
                extracted: result.extracted,
              };
            }
          } else {
            result = {
              ok: false,
              error: `Expectation failed after action ${step.action.type}`,
              extracted: result.extracted,
            };
          }
        }
      }

      steps.push({
        stepIndex: index,
        stepId: step.id,
        ok: result.ok,
        action: step.action,
        error: result.error,
        extracted: result.extracted,
        recovered,
        experienceApplied,
        state: currentState,
        diff,
      });

      metrics.recordStep({
        ok: result.ok,
        recovered,
        experienceApplied,
      });
      previousState = currentState;

      if (!result.ok) {
        if (step.optional) continue;
        const screenshotPath = await this.captureFailureScreenshot(
          options.screenshotDir,
          plan.goal,
          index,
        );
        if (screenshotPath) metrics.addScreenshot(screenshotPath);
        const finished = metrics.finish();
        return {
          ok: false,
          goal: plan.goal,
          steps,
          finalState: currentState,
          llmCallsAvoided,
          error: result.error,
          resumeFromStep: index,
          screenshotPath,
          metrics: {
            durationMs: finished.durationMs,
            recoveries: finished.recoveries,
            experienceHits: finished.experienceHits,
            steps: finished.steps,
          },
        };
      }
    }

    const finished = metrics.finish();
    return {
      ok: true,
      goal: plan.goal,
      steps,
      finalState: currentState,
      llmCallsAvoided,
      metrics: {
        durationMs: finished.durationMs,
        recoveries: finished.recoveries,
        experienceHits: finished.experienceHits,
        steps: finished.steps,
      },
    };
  }

  private async captureFailureScreenshot(
    screenshotDir: string | undefined,
    goal: string,
    stepIndex: number,
  ): Promise<string | undefined> {
    if (!screenshotDir) return undefined;
    try {
      mkdirSync(screenshotDir, { recursive: true });
      const safe = goal.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40) || "run";
      const path = join(
        screenshotDir,
        `${Date.now()}-${safe}-step${stepIndex}.png`,
      );
      await this.tabs.getPage().screenshot({ path, fullPage: true });
      return path;
    } catch {
      return undefined;
    }
  }

  private async checkExpect(
    expect: NonNullable<Plan["steps"][number]["expect"]>,
    selectors: SelectorEngine,
    state: SemanticState,
  ): Promise<boolean> {
    if (expect.urlIncludes && !state.url.includes(expect.urlIncludes)) return false;
    if (expect.text) {
      const visible = await this.tabs
        .getPage()
        .getByText(expect.text)
        .first()
        .isVisible()
        .catch(() => false);
      if (!visible) return false;
    }
    if (expect.target) {
      const exists = await selectors.exists(expect.target, 2000);
      if (!exists) return false;
    }
    return true;
  }

  private async recover(input: {
    executor: ActionExecutor;
    goal: string;
    error: string;
    state: SemanticState;
  }): Promise<{ recovered: boolean; llmCallsAvoided: number; experienceId?: number }> {
    const problem = classifyProblem(input.error, input.state);
    let llmCallsAvoided = 0;

    const remembered = await this.experiences.findBest({
      site: input.state.domain,
      stateHash: input.state.fingerprint,
      problem,
      minConfidence: this.policy.experienceAutoApplyMinConfidence,
      pageHint: input.state.pageHint,
      signals: input.state.signals,
      goal: input.goal,
    });

    const candidateFixes: Array<{ fix: Action[]; experienceId?: number }> = [];
    if (remembered) {
      candidateFixes.push({ fix: remembered.fix, experienceId: remembered.id });
    }
    for (const fix of this.plugins.recoveryFixes(problem, input.state)) {
      candidateFixes.push({ fix });
    }
    for (const fix of heuristicFixes(problem)) {
      candidateFixes.push({ fix });
    }

    const max = Math.min(this.policy.maxRecoveries, candidateFixes.length);
    for (let i = 0; i < max; i++) {
      const candidate = candidateFixes[i]!;
      let fixOk = true;
      for (const action of candidate.fix) {
        const applied = await input.executor.execute(action);
        if (!applied.ok) {
          fixOk = false;
          break;
        }
      }
      if (!fixOk) {
        if (candidate.experienceId) {
          this.experiences.markResult(candidate.experienceId, false);
        }
        continue;
      }

      if (candidate.experienceId) {
        this.experiences.markResult(candidate.experienceId, true);
        llmCallsAvoided += 1;
        return {
          recovered: true,
          llmCallsAvoided,
          experienceId: candidate.experienceId,
        };
      }

      const saved = await this.experiences.remember({
        site: input.state.domain,
        goal: input.goal,
        stateHash: input.state.fingerprint,
        problem,
        fix: candidate.fix,
        success: true,
        pageHint: input.state.pageHint,
        signals: input.state.signals,
      });
      llmCallsAvoided += 1;
      return { recovered: true, llmCallsAvoided, experienceId: saved.id };
    }

    return { recovered: false, llmCallsAvoided };
  }
}
