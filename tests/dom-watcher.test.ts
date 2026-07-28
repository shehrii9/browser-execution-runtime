import { describe, expect, it } from "vitest";
import {
  domWatchEnabled,
  mergeDomBatches,
  resolveDomWatchDebounceMs,
} from "../src/browser/domWatcher.js";
import { EventBus } from "../src/events/bus.js";

describe("dom mutation watcher helpers", () => {
  it("mergeDomBatches aggregates counts", () => {
    const merged = mergeDomBatches(
      {
        mutations: 2,
        addedNodes: 1,
        removedNodes: 0,
        attributeChanges: 1,
        timestamp: 100,
        url: "https://a.test",
      },
      {
        mutations: 3,
        addedNodes: 2,
        removedNodes: 1,
        attributeChanges: 0,
        timestamp: 200,
        url: "https://b.test",
      },
    );
    expect(merged.mutations).toBe(5);
    expect(merged.addedNodes).toBe(3);
    expect(merged.removedNodes).toBe(1);
    expect(merged.attributeChanges).toBe(1);
    expect(merged.timestamp).toBe(200);
    expect(merged.url).toBe("https://b.test");
  });

  it("domWatchEnabled respects BER_DOM_WATCH", () => {
    expect(domWatchEnabled({ BER_DOM_WATCH: "0" })).toBe(false);
    expect(domWatchEnabled({ BER_DOM_WATCH: "false" })).toBe(false);
    expect(domWatchEnabled({})).toBe(true);
  });

  it("resolveDomWatchDebounceMs parses env", () => {
    expect(resolveDomWatchDebounceMs({ BER_DOM_WATCH_DEBOUNCE_MS: "100" })).toBe(100);
    expect(resolveDomWatchDebounceMs({ BER_DOM_WATCH_DEBOUNCE_MS: "nope" })).toBe(400);
  });

  it("EventBus accepts dom_change type", () => {
    const bus = new EventBus();
    const ev = bus.emit("dom_change", { mutations: 4 });
    expect(ev.type).toBe("dom_change");
    expect(bus.list({ type: "dom_change" })).toHaveLength(1);
  });
});
