import { describe, expect, it } from "vitest";
import { classifyProblem, heuristicFixes } from "../src/recovery/engine.js";

describe("recovery engine", () => {
  it("classifies cookie problems", () => {
    expect(
      classifyProblem("click failed", {
        url: "https://x.test",
        title: "x",
        domain: "x.test",
        pageHint: "home",
        dialogs: [],
        buttons: ["Accept all"],
        inputs: [],
        links: [],
        nodes: [],
        signals: ["cookie_banner"],
        fingerprint: "1",
        observedAt: new Date().toISOString(),
      }),
    ).toBe("cookie_banner");
  });

  it("returns dismiss overlay heuristics", () => {
    const fixes = heuristicFixes("cookie_banner");
    expect(fixes[0]?.[0]?.type).toBe("dismiss_overlays");
  });
});
