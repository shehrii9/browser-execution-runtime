export interface RunMetrics {
  startedAt: string;
  finishedAt?: string;
  durationMs?: number;
  steps: number;
  successes: number;
  failures: number;
  recoveries: number;
  experienceHits: number;
  llmCallsAvoided: number;
  screenshots: string[];
}

export class MetricsCollector {
  private current: RunMetrics | null = null;
  private history: RunMetrics[] = [];

  start(): void {
    this.current = {
      startedAt: new Date().toISOString(),
      steps: 0,
      successes: 0,
      failures: 0,
      recoveries: 0,
      experienceHits: 0,
      llmCallsAvoided: 0,
      screenshots: [],
    };
  }

  recordStep(input: {
    ok: boolean;
    recovered?: boolean;
    experienceApplied?: number;
  }): void {
    if (!this.current) this.start();
    const m = this.current!;
    m.steps += 1;
    if (input.ok) m.successes += 1;
    else m.failures += 1;
    if (input.recovered) m.recoveries += 1;
    if (input.experienceApplied) m.experienceHits += 1;
  }

  addLlmCallsAvoided(n: number): void {
    if (!this.current) this.start();
    this.current!.llmCallsAvoided += n;
  }

  addScreenshot(path: string): void {
    if (!this.current) this.start();
    this.current!.screenshots.push(path);
  }

  finish(): RunMetrics {
    if (!this.current) this.start();
    const m = this.current!;
    m.finishedAt = new Date().toISOString();
    m.durationMs =
      Date.parse(m.finishedAt) - Date.parse(m.startedAt);
    this.history.unshift(m);
    this.history = this.history.slice(0, 50);
    this.current = null;
    return m;
  }

  snapshot(): { current: RunMetrics | null; recent: RunMetrics[] } {
    return { current: this.current, recent: this.history };
  }
}
