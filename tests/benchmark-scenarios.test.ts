import { describe, expect, it } from "vitest";
import { REPLAY_SCENARIOS } from "../benchmarks/scenarios.js";

describe("replay benchmark scenarios", () => {
  it("defines cookie, login, scroll, and media scenarios", () => {
    const ids = REPLAY_SCENARIOS.map((s) => s.id);
    expect(ids).toEqual(
      expect.arrayContaining(["cookie-shop", "login-wall", "infinite-scroll", "media-skip-ad"]),
    );
    expect(ids).toHaveLength(4);
  });

  it("builds plans with absolute fixture URLs", () => {
    const url = "http://127.0.0.1:1234/";
    for (const scenario of REPLAY_SCENARIOS) {
      const plan = scenario.plan(url);
      expect(plan.steps.length).toBeGreaterThan(0);
      expect(plan.steps[0]?.action.type).toBe("navigate");
      if (plan.steps[0]?.action.type === "navigate") {
        expect(plan.steps[0].action.url).toBe(url);
      }
    }
  });
});
