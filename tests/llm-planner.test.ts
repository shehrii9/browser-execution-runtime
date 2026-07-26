import { describe, expect, it, vi } from "vitest";
import { LlmPlanner } from "../src/planner/llm.js";

describe("LlmPlanner", () => {
  it("works without an API key", async () => {
    const fetchImpl = vi.fn(async (_url, init) => {
      const headers = new Headers((init as RequestInit).headers);
      expect(headers.get("authorization")).toBeNull();
      return new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  goal: "open example",
                  steps: [
                    {
                      action: {
                        type: "navigate",
                        url: "https://example.com",
                      },
                    },
                  ],
                }),
              },
            },
          ],
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    }) as unknown as typeof fetch;

    const planner = new LlmPlanner({
      apiBase: "http://127.0.0.1:11434/v1",
      model: "llama3.2",
      fetchImpl,
    });

    const plan = await planner.plan("open example.com");
    expect(plan?.steps[0]?.action.type).toBe("navigate");
  });

  it("falls back to builtin planner on failure", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error("network down");
    }) as unknown as typeof fetch;

    const planner = new LlmPlanner({
      apiBase: "http://127.0.0.1:11434/v1",
      model: "llama3.2",
      fetchImpl,
    });

    const plan = await planner.plan("open https://example.com");
    expect(plan?.steps[0]?.action.type).toBe("navigate");
  });
});
