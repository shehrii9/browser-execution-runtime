import { describe, expect, it } from "vitest";
import { BuiltinPlanner } from "../src/planner/engine.js";

describe("BuiltinPlanner", () => {
  it("plans open intents", async () => {
    const planner = new BuiltinPlanner();
    const plan = await planner.plan("open https://example.com");
    expect(plan?.steps[0]?.action.type).toBe("navigate");
  });

  it("returns null for free-form intents", async () => {
    const planner = new BuiltinPlanner();
    await expect(planner.plan("buy cheapest keyboard")).resolves.toBeNull();
  });
});
