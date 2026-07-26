import type { Page } from "playwright";
import { ExperienceStore } from "../experience/store.js";
import { classifyProblem, heuristicFixes } from "../recovery/engine.js";
import { diffStates } from "../state/diff.js";
import { observePage } from "../state/observe.js";
import type {
  Action,
  Plan,
  Policy,
  RunResult,
  SemanticState,
  StepResult,
} from "../types.js";
import { ActionExecutor } from "./actions.js";
import { SelectorEngine } from "../selectors/engine.js";

export class PlanRunner {
  constructor(
    private readonly page: Page,
    private readonly policy: Policy,
    private readonly experiences: ExperienceStore,
  ) {}

  async run(plan: Plan): Promise<RunResult> {
    const executor = new ActionExecutor(this.page, this.policy);
    const selectors = new SelectorEngine(this.page);
    const steps: StepResult[] = [];
    let previousState: SemanticState | undefined;
    let llmCallsAvoided = 0;
    let currentState = await observePage(this.page);
    previousState = currentState;

    const limitedSteps = plan.steps.slice(0, this.policy.maxSteps);

    for (let index = 0; index < limitedSteps.length; index++) {
      const step = limitedSteps[index]!;
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
        recovered = recovery.recovered;
        experienceApplied = recovery.experienceId;

        if (recovery.recovered) {
          result = await executor.execute(step.action);
        }
      }

      currentState = await observePage(this.page);
      const diff = diffStates(previousState, currentState);

      if (result.ok && step.expect) {
        const expectOk = await this.checkExpect(step.expect, selectors, currentState);
        if (!expectOk) {
          result = {
            ok: false,
            error: `Expectation failed after action ${step.action.type}`,
            extracted: result.extracted,
          };
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

      previousState = currentState;

      if (!result.ok) {
        if (step.optional) continue;
        return {
          ok: false,
          goal: plan.goal,
          steps,
          finalState: currentState,
          llmCallsAvoided,
          error: result.error,
        };
      }
    }

    return {
      ok: true,
      goal: plan.goal,
      steps,
      finalState: currentState,
      llmCallsAvoided,
    };
  }

  private async checkExpect(
    expect: NonNullable<Plan["steps"][number]["expect"]>,
    selectors: SelectorEngine,
    state: SemanticState,
  ): Promise<boolean> {
    if (expect.urlIncludes && !state.url.includes(expect.urlIncludes)) return false;
    if (expect.text) {
      const visible = await this.page.getByText(expect.text).first().isVisible().catch(() => false);
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

    const remembered = this.experiences.findBest({
      site: input.state.domain,
      stateHash: input.state.fingerprint,
      problem,
      minConfidence: this.policy.experienceAutoApplyMinConfidence,
    });

    const candidateFixes: Action[][] = [];
    if (remembered) {
      candidateFixes.push(remembered.fix);
    }
    candidateFixes.push(...heuristicFixes(problem));

    const max = Math.min(this.policy.maxRecoveries, candidateFixes.length);
    for (let i = 0; i < max; i++) {
      const fix = candidateFixes[i]!;
      let fixOk = true;
      for (const action of fix) {
        const applied = await input.executor.execute(action);
        if (!applied.ok) {
          fixOk = false;
          break;
        }
      }
      if (!fixOk) {
        if (remembered && i === 0) this.experiences.markResult(remembered.id, false);
        continue;
      }

      // Recovery considered successful if we could apply the fix sequence.
      if (remembered && i === 0) {
        this.experiences.markResult(remembered.id, true);
        llmCallsAvoided += 1;
        return { recovered: true, llmCallsAvoided, experienceId: remembered.id };
      }

      const saved = this.experiences.remember({
        site: input.state.domain,
        goal: input.goal,
        stateHash: input.state.fingerprint,
        problem,
        fix,
        success: true,
      });
      llmCallsAvoided += 1;
      return { recovered: true, llmCallsAvoided, experienceId: saved.id };
    }

    return { recovered: false, llmCallsAvoided };
  }
}
