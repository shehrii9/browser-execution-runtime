import { describe, expect, it } from "vitest";
import { EventBus } from "../src/events/bus.js";
import { SelectorEngine } from "../src/selectors/engine.js";
import { ActionSchema, TargetRefSchema } from "../src/types.js";
import { heuristicFixes } from "../src/recovery/engine.js";

describe("EventBus", () => {
  it("emits, buffers, and filters events", () => {
    const bus = new EventBus(10);
    const seen: string[] = [];
    const off = bus.on((e) => seen.push(e.type));
    bus.emit("attached", { url: "https://example.com" });
    bus.emit("step_start", { action: "click" });
    bus.emit("recovery", { recovered: true });
    expect(seen).toEqual(["attached", "step_start", "recovery"]);
    expect(bus.list({ type: "recovery" })).toHaveLength(1);
    expect(bus.list({ afterId: 1 }).every((e) => e.id > 1)).toBe(true);
    off();
    bus.emit("observe", { url: "x" });
    expect(seen).toHaveLength(3);
  });
});

describe("iframe targets", () => {
  it("accepts frame / frameUrl on TargetRef", () => {
    const target = TargetRefSchema.parse({
      role: "button",
      name: "Accept all",
      frame: "iframe#consent",
      frameUrl: "consent",
    });
    expect(target.frame).toBe("iframe#consent");
    expect(target.frameUrl).toBe("consent");
  });

  it("includes iframe clicks in cookie recovery heuristics", () => {
    const fixes = heuristicFixes("cookie_banner");
    const flat = fixes.flat();
    expect(
      flat.some(
        (a) =>
          a.type === "click" &&
          "target" in a &&
          Boolean(a.target.frame || a.target.frameUrl),
      ),
    ).toBe(true);
  });

  it("builds frame-scoped locators without throwing", () => {
    // Minimal page stub — only resolveScope/locate construction matters here.
    const page = {
      mainFrame: () => ({ url: () => "https://example.com" }),
      frames: () => [
        { url: () => "https://example.com", name: () => "" },
        { url: () => "https://consent.example/cmp", name: () => "cmp", getByRole: () => ({ first: () => ({}) }), getByText: () => ({ first: () => ({}) }), getByPlaceholder: () => ({ first: () => ({}) }), getByTestId: () => ({ first: () => ({}) }), getByLabel: () => ({ first: () => ({}) }), locator: () => ({ first: () => ({}) }) },
      ],
      frame: ({ name }: { name: string }) =>
        name === "cmp"
          ? {
              getByRole: () => ({ first: () => ({}) }),
              locator: () => ({ first: () => ({}) }),
              getByTestId: () => ({ first: () => ({}) }),
              getByPlaceholder: () => ({ first: () => ({}) }),
              getByText: () => ({ first: () => ({}) }),
              getByLabel: () => ({ first: () => ({}) }),
            }
          : null,
      frameLocator: (sel: string) => ({
        getByRole: () => ({ first: () => ({}) }),
        locator: () => ({ first: () => ({}) }),
        getByTestId: () => ({ first: () => ({}) }),
        getByPlaceholder: () => ({ first: () => ({}) }),
        getByText: () => ({ first: () => ({}) }),
        getByLabel: () => ({ first: () => ({}) }),
      }),
      getByRole: () => ({
        first: () => ({}),
        or: () => ({ or: () => ({ first: () => ({}) }) }),
      }),
      locator: () => ({ first: () => ({}) }),
      getByTestId: () => ({ first: () => ({}) }),
      getByPlaceholder: () => ({ first: () => ({}) }),
      getByText: () => ({ first: () => ({}) }),
      getByLabel: () => ({ first: () => ({}) }),
    };
    const engine = new SelectorEngine(page as never);
    expect(() =>
      engine.locate({ role: "button", name: "Accept", frame: "iframe" }),
    ).not.toThrow();
    expect(() =>
      engine.locate({ text: "OK", frameUrl: "consent" }),
    ).not.toThrow();
    expect(() =>
      engine.locate({ role: "button", name: "Accept", frameName: "cmp" }),
    ).not.toThrow();
    expect(() =>
      engine.locate({ role: "button", name: "Accept", frameIndex: 1 }),
    ).not.toThrow();
  });
});

describe("ActionSchema settle + frame", () => {
  it("parses framed click actions", () => {
    const action = ActionSchema.parse({
      type: "click",
      target: { role: "button", name: "Accept all", frame: "iframe" },
    });
    expect(action.type).toBe("click");
  });
});
