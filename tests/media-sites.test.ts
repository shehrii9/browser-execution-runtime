import { describe, expect, it } from "vitest";
import {
  isLegacyBroadPlayerCss,
  MEDIA_PLAYER_TARGET_CSS,
} from "../src/browser/mediaPlayer.js";
import { BuiltinPlanner } from "../src/planner/engine.js";
import { PluginRegistry } from "../src/plugins/registry.js";
import { mediaSitesPlugin } from "../src/plugins/mediaSites.js";
import { isMediaHost, pageHintFromUrl } from "../src/state/fingerprint.js";
import { ActionSchema } from "../src/types.js";

describe("media sites + dynamic settle", () => {
  it("uses safe media player selectors (no script[class*=player] trap)", () => {
    expect(isLegacyBroadPlayerCss("[class*='player']")).toBe(true);
    expect(MEDIA_PLAYER_TARGET_CSS).not.toMatch(/class\*='player'/i);
  });

  it("detects media page hints across hosts", () => {
    expect(pageHintFromUrl("https://www.youtube.com/watch?v=abc", "Video")).toBe(
      "watch",
    );
    expect(
      pageHintFromUrl("https://www.youtube.com/results?search_query=cats", "Search"),
    ).toBe("results");
    expect(pageHintFromUrl("https://www.youtube.com/", "YouTube")).toBe("media_home");
    expect(pageHintFromUrl("https://vimeo.com/123456789", "Clip")).toBe("watch");
    expect(pageHintFromUrl("https://www.twitch.tv/directory", "Browse")).toBe("results");
    expect(pageHintFromUrl("https://soundcloud.com/search?q=lofi", "Search")).toBe(
      "results",
    );
    expect(isMediaHost("www.vimeo.com")).toBe(true);
    expect(isMediaHost("example.com")).toBe(false);
  });

  it("registers media-sites plugin recovery and workflows", () => {
    const registry = new PluginRegistry();
    expect(registry.list().map((p) => p.id)).toContain("media-sites");
    const fixes = registry.recoveryFixes("target_not_found", {
      url: "https://vimeo.com/1",
      title: "Watch",
      domain: "vimeo.com",
      pageHint: "watch",
      dialogs: [],
      buttons: ["Skip Ad"],
      inputs: [],
      links: [],
      nodes: [],
      signals: ["skip_ad", "video_player", "media_site"],
      fingerprint: "m",
      observedAt: new Date().toISOString(),
    });
    expect(fixes.length).toBeGreaterThan(0);
    expect(registry.workflowsFor("vimeo.com").ready_player?.length).toBeGreaterThan(0);
    expect(mediaSitesPlugin.domains).toContain("vimeo.com");
    expect(mediaSitesPlugin.domains).toContain("youtube.com");
  });

  it("plans open media-site and search intents", async () => {
    const planner = new BuiltinPlanner();
    const openYt = await planner.plan("open youtube");
    expect(openYt?.steps[0]?.action.type).toBe("navigate");

    const openVimeo = await planner.plan("open vimeo");
    expect(openVimeo?.steps[0]?.action.type).toBe("navigate");

    const search = await planner.plan("search cats on vimeo.com");
    expect(search?.steps.some((s) => s.action.type === "type")).toBe(true);
    expect(search?.steps.some((s) => s.action.type === "wait")).toBe(true);
  });

  it("plans run workflow on media domain", async () => {
    const planner = new BuiltinPlanner();
    const plan = await planner.plan("run ready_player on vimeo.com");
    expect(plan?.metadata?.workflow).toBe("ready_player");
    expect(plan?.steps.length).toBeGreaterThan(1);
  });

  it("accepts wait.settle in ActionSchema", () => {
    const action = ActionSchema.parse({
      type: "wait",
      settle: true,
      networkIdle: true,
      timeoutMs: 5000,
    });
    expect(action.type).toBe("wait");
    if (action.type === "wait") {
      expect(action.settle).toBe(true);
    }
  });
});
