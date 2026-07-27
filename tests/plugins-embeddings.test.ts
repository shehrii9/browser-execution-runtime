import { describe, expect, it, vi } from "vitest";
import { NeuralEmbedder, HashingEmbedder } from "../src/memory/embedder.js";
import { PluginRegistry } from "../src/plugins/registry.js";

describe("default plugins", () => {
  it("registers github/google/amazon/auth helpers", () => {
    const registry = new PluginRegistry();
    const ids = registry.list().map((p) => p.id);
    expect(ids).toEqual(
      expect.arrayContaining([
        "cookie-consent",
        "auth-modal",
        "github",
        "google",
        "amazon",
      ]),
    );
    expect(registry.workflowsFor("github.com").openNotifications).toBeTruthy();
  });
});

describe("NeuralEmbedder", () => {
  it("uses OpenAI-compatible embeddings without requiring a key", async () => {
    const fetchImpl = vi.fn(async (_url, init) => {
      const headers = new Headers((init as RequestInit).headers);
      expect(headers.get("authorization")).toBeNull();
      return new Response(
        JSON.stringify({ data: [{ embedding: [0.1, 0.2, 0.3, 0.4] }] }),
        { status: 200 },
      );
    }) as unknown as typeof fetch;

    const embedder = new NeuralEmbedder({
      apiBase: "http://127.0.0.1:11434/v1",
      model: "nomic-embed-text",
      fetchImpl,
    });
    const vec = await embedder.embed("cookie banner checkout");
    expect(vec.length).toBe(4);
    expect(vec[0]).toBeCloseTo(0.1);
    expect(vec[3]).toBeCloseTo(0.4);
  });

  it("falls back to hashing when embeddings API fails", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error("down");
    }) as unknown as typeof fetch;
    const embedder = new NeuralEmbedder({
      apiBase: "http://127.0.0.1:1/v1",
      fetchImpl,
      fallback: new HashingEmbedder(),
    });
    const vec = await embedder.embed("hello world");
    expect(vec.length).toBe(128);
  });
});
