import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { BrowserRuntime } from "../src/runtime.js";
import {
  comparisonBlock,
  startFixtureServer,
  summarizePass,
  type ReplayReport,
} from "./replay-harness.js";
import { REPLAY_SCENARIOS } from "./scenarios.js";

export async function runReplayScenario(
  scenarioId: string,
  options: { dataDir?: string } = {},
): Promise<ReplayReport> {
  const scenario = REPLAY_SCENARIOS.find((s) => s.id === scenarioId);
  if (!scenario) throw new Error(`Unknown replay scenario: ${scenarioId}`);

  const server = await startFixtureServer(scenario.fixture, scenario.fixturePath ?? "/");
  const pageUrl = server.url();
  const dataDir = options.dataDir ?? mkdtempSync(join(tmpdir(), `ber-bench-${scenario.id}-`));
  const runtime = new BrowserRuntime({
    dataDir,
    policy: { headless: true, ...scenario.policy },
  });

  const plan = scenario.plan(pageUrl);
  const baseline = scenario.baselineEstimatedLlmCalls;

  try {
    await runtime.attach({ startUrl: pageUrl });
    const first = await runtime.run(plan);
    let second;
    if (!scenario.singlePass) {
      second = await runtime.run(plan);
    }

    const status = await runtime.status();
    const report: ReplayReport = {
      scenario: scenario.id,
      fixture: pageUrl,
      first: summarizePass(first),
      second: second ? summarizePass(second) : undefined,
      comparison: comparisonBlock(
        baseline,
        summarizePass(first),
        second ? summarizePass(second) : undefined,
        status.experienceCount,
      ),
    };
    if (!first.ok || (second && !second.ok)) {
      throw Object.assign(new Error(`${scenario.id} replay failed`), { report });
    }
    return report;
  } finally {
    await runtime.close();
    server.close();
  }
}

export async function runAllReplayScenarios(
  filter?: string[],
): Promise<ReplayReport[]> {
  const ids = filter?.length ? filter : REPLAY_SCENARIOS.map((s) => s.id);
  const reports: ReplayReport[] = [];
  const failures: ReplayReport[] = [];

  for (const id of ids) {
    try {
      reports.push(await runReplayScenario(id));
    } catch (error) {
      const report = (error as { report?: ReplayReport }).report;
      if (report) failures.push(report);
      else throw error;
    }
  }

  const payload = {
    scenarios: reports,
    failures,
    summary: {
      ran: ids.length,
      passed: reports.length,
      failed: failures.length,
    },
  };
  console.log(JSON.stringify(payload, null, 2));
  if (failures.length) process.exitCode = 1;
  return reports;
}
