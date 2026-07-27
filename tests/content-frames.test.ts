import { describe, expect, it } from "vitest";
import { PluginRegistry } from "../src/plugins/registry.js";
import { contentSitesPlugin } from "../src/plugins/contentSites.js";
import { pageHintFromUrl } from "../src/state/fingerprint.js";
import { TargetRefSchema } from "../src/types.js";

describe("content sites + frame targeting", () => {
  it("registers content-sites plugin", () => {
    const registry = new PluginRegistry();
    expect(registry.list().map((p) => p.id)).toEqual(
      expect.arrayContaining(["media-sites", "content-sites"]),
    );
    expect(contentSitesPlugin.workflows?.read_article?.length).toBeGreaterThan(0);
    const fixes = registry.recoveryFixes("cookie_banner", {
      url: "https://www.bbc.com/news",
      title: "News",
      domain: "www.bbc.com",
      pageHint: "article",
      dialogs: [],
      buttons: ["Accept all"],
      inputs: [],
      links: [],
      nodes: [],
      signals: ["cookie_banner"],
      fingerprint: "c",
      observedAt: new Date().toISOString(),
    });
    expect(fixes.length).toBeGreaterThan(0);
  });

  it("detects article page hints", () => {
    expect(pageHintFromUrl("https://www.bbc.com/news/world-123", "Story")).toBe(
      "article",
    );
    expect(pageHintFromUrl("https://en.wikipedia.org/wiki/Browser", "Wiki")).toBe(
      "article",
    );
  });

  it("accepts frameName and frameIndex on targets", () => {
    const target = TargetRefSchema.parse({
      role: "button",
      name: "Accept",
      frameUrl: "consent",
      frameName: "cmp",
      frameIndex: 2,
    });
    expect(target.frameName).toBe("cmp");
    expect(target.frameIndex).toBe(2);
  });
});
