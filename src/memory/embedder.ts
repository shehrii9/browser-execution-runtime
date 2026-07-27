import { embedText } from "./embeddings.js";

export interface Embedder {
  readonly id: string;
  embed(text: string): Promise<Float32Array>;
}

export class HashingEmbedder implements Embedder {
  readonly id = "local_hashing";

  async embed(text: string): Promise<Float32Array> {
    return embedText(text);
  }
}

export interface NeuralEmbedderOptions {
  apiBase: string;
  apiKey?: string;
  model?: string;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
  fallback?: Embedder;
}

/**
 * Optional neural embeddings via any OpenAI-compatible /embeddings endpoint.
 * API key optional. Falls back to local hashing on failure.
 */
export class NeuralEmbedder implements Embedder {
  readonly id = "openai_compatible_embeddings";
  private readonly fallback: Embedder;
  private readonly fetchImpl: typeof fetch;

  constructor(private readonly options: NeuralEmbedderOptions) {
    this.fallback = options.fallback ?? new HashingEmbedder();
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  async embed(text: string): Promise<Float32Array> {
    try {
      const base = this.options.apiBase.replace(/\/$/, "");
      const headers: Record<string, string> = {
        "content-type": "application/json",
      };
      if (this.options.apiKey) {
        headers.authorization = `Bearer ${this.options.apiKey}`;
      }
      const controller = new AbortController();
      const timer = setTimeout(
        () => controller.abort(),
        this.options.timeoutMs ?? 30_000,
      );
      try {
        const res = await this.fetchImpl(`${base}/embeddings`, {
          method: "POST",
          headers,
          body: JSON.stringify({
            model: this.options.model ?? "text-embedding-3-small",
            input: text,
          }),
          signal: controller.signal,
        });
        if (!res.ok) throw new Error(`embeddings HTTP ${res.status}`);
        const data = (await res.json()) as {
          data?: Array<{ embedding?: number[] }>;
        };
        const values = data.data?.[0]?.embedding;
        if (!values?.length) throw new Error("empty embedding");
        return Float32Array.from(values);
      } finally {
        clearTimeout(timer);
      }
    } catch {
      return this.fallback.embed(text);
    }
  }
}

export function experienceText(parts: {
  site: string;
  problem: string;
  pageHint?: string;
  signals?: string[];
  goal?: string;
}): string {
  return [
    parts.site,
    parts.problem,
    parts.pageHint ?? "",
    ...(parts.signals ?? []),
    parts.goal ?? "",
  ].join(" ");
}

export function createEmbedderFromEnv(
  env: NodeJS.ProcessEnv = process.env,
): Embedder {
  const apiBase =
    env.BER_EMBEDDINGS_API_BASE ||
    env.BER_LLM_API_BASE ||
    env.OPENAI_BASE_URL;
  if (!apiBase || env.BER_EMBEDDINGS === "0" || env.BER_EMBEDDINGS === "hash") {
    return new HashingEmbedder();
  }
  return new NeuralEmbedder({
    apiBase,
    apiKey:
      env.BER_EMBEDDINGS_API_KEY ||
      env.BER_LLM_API_KEY ||
      env.OPENAI_API_KEY,
    model: env.BER_EMBEDDINGS_MODEL || "text-embedding-3-small",
    timeoutMs: Number(env.BER_EMBEDDINGS_TIMEOUT_MS ?? 30_000),
  });
}
