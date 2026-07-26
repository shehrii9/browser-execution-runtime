import type { Action, Plan, Policy, RunResult, SemanticState } from "../types.js";

export interface HermesRuntimeClientOptions {
  baseUrl?: string;
  fetchImpl?: typeof fetch;
}

export class HermesRuntimeClient {
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;

  constructor(options: HermesRuntimeClientOptions = {}) {
    this.baseUrl = (options.baseUrl ?? "http://127.0.0.1:8787").replace(/\/$/, "");
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  health(): Promise<{ ok: boolean }> {
    return this.get("/health");
  }

  status(): Promise<unknown> {
    return this.get("/status");
  }

  observe(): Promise<SemanticState> {
    return this.get("/observe");
  }

  diff(): Promise<unknown> {
    return this.get("/diff");
  }

  experiences(): Promise<unknown> {
    return this.get("/experiences");
  }

  metrics(): Promise<unknown> {
    return this.get("/metrics");
  }

  tabs(): Promise<unknown> {
    return this.get("/tabs");
  }

  plugins(): Promise<unknown> {
    return this.get("/plugins");
  }

  attach(body: {
    startUrl?: string;
    cdpUrl?: string;
    userDataDir?: string;
    headless?: boolean;
  }): Promise<{ ok: boolean; state: SemanticState }> {
    return this.post("/attach", body);
  }

  act(action: Action): Promise<unknown> {
    return this.post("/act", { action });
  }

  run(plan: Plan, resumeFromStep?: number): Promise<RunResult> {
    return this.post("/run", { plan, resumeFromStep });
  }

  execute(intent: string): Promise<RunResult> {
    return this.post("/execute", { intent });
  }

  resume(): Promise<RunResult> {
    return this.post("/resume", {});
  }

  setPolicy(policy: Partial<Policy>): Promise<unknown> {
    return this.post("/policy", policy);
  }

  remember(body: unknown): Promise<unknown> {
    return this.post("/remember", body);
  }

  private async get<T>(path: string): Promise<T> {
    const res = await this.fetchImpl(`${this.baseUrl}${path}`);
    return parseResponse<T>(res);
  }

  private async post<T>(path: string, body: unknown): Promise<T> {
    const res = await this.fetchImpl(`${this.baseUrl}${path}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body ?? {}),
    });
    return parseResponse<T>(res);
  }
}

async function parseResponse<T>(res: Response): Promise<T> {
  const data = await res.json();
  if (!res.ok) {
    const message =
      typeof data === "object" && data && "error" in data
        ? String((data as { error: unknown }).error)
        : `HTTP ${res.status}`;
    throw new Error(message);
  }
  return data as T;
}
