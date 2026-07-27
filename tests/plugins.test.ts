import { describe, expect, it } from "vitest";
import { PluginRegistry } from "../src/plugins/registry.js";

describe("PluginRegistry", () => {
  it("returns cookie consent recovery fixes", () => {
    const registry = new PluginRegistry();
    const fixes = registry.recoveryFixes("cookie_banner", {
      url: "https://shop.test/cart",
      title: "Cart",
      domain: "shop.test",
      pageHint: "checkout",
      dialogs: ["cookie"],
      buttons: ["Accept all", "Checkout"],
      inputs: [],
      links: [],
      nodes: [],
      signals: ["cookie_banner"],
      fingerprint: "x",
      observedAt: new Date().toISOString(),
    });
    expect(fixes.length).toBeGreaterThan(0);
    expect(fixes[0]?.[0]?.type).toBe("dismiss_overlays");
    expect(registry.list().map((p) => p.id)).toEqual(
      expect.arrayContaining(["cookie-consent", "media-sites", "content-sites"]),
    );
  });
});
