import { describe, expect, it } from "vitest";
import { diffStates } from "../src/state/diff.js";
import type { SemanticState } from "../src/types.js";

function state(partial: Partial<SemanticState>): SemanticState {
  return {
    url: "https://example.com",
    title: "Example",
    domain: "example.com",
    pageHint: "home",
    dialogs: [],
    buttons: ["Accept"],
    inputs: [],
    links: [],
    nodes: [],
    signals: ["page:home"],
    fingerprint: "abc",
    observedAt: new Date().toISOString(),
    ...partial,
  };
}

describe("diffStates", () => {
  it("summarizes button and signal changes", () => {
    const before = state({});
    const after = state({
      buttons: ["Checkout"],
      signals: ["page:home", "checkout_available"],
      url: "https://example.com/cart",
      pageHint: "checkout",
    });
    const diff = diffStates(before, after);
    expect(diff.urlChanged).toBe(true);
    expect(diff.addedSignals).toContain("checkout_available");
    expect(diff.removedButtons).toContain("Accept");
    expect(diff.addedButtons).toContain("Checkout");
    expect(diff.summary.length).toBeGreaterThan(0);
  });
});
