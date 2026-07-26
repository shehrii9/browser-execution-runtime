import { describe, expect, it, vi } from "vitest";
import { HermesPlanner } from "../src/planner/hermes.js";

describe("HermesPlanner", () => {
  it("parses JSON plans from OpenAI-compatible responses", async () => {
    const fetchImpl = vi.fn(async () => {
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

    const planner = new HermesPlanner({
      apiBase: "http://hermes.local/v1",
      model: "hermes",
      fetchImpl,
    });

    const plan = await planner.plan("open example.com and read title");
    expect(plan?.goal).toBe("open example");
    expect(plan?.steps[0]?.action.type).toBe("navigate");
    expect(fetchImpl).toHaveBeenCalledOnce();
  });

  it("falls back to builtin planner on failure", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error("network down");
    }) as unknown as typeof fetch;

    const planner = new HermesPlanner({
      apiBase: "http://hermes.local/v1",
      model: "hermes",
      fetchImpl,
    });

    const plan = await planner.plan("open https://example.com");
    expect(plan?.steps[0]?.action.type).toBe("navigate");
  });
});
