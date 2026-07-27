import { describe, expect, it } from "vitest";
import { BuiltinPlanner } from "../src/planner/engine.js";
import { PluginRegistry } from "../src/plugins/registry.js";
import { youtubePlugin } from "../src/plugins/youtube.js";
import { pageHintFromUrl } from "../src/state/fingerprint.js";
import { ActionSchema } from "../src/types.js";

describe("YouTube + dynamic settle", () => {
  it("detects YouTube page hints", () => {
    expect(pageHintFromUrl("https://www.youtube.com/watch?v=abc", "Video")).toBe(
      "watch",
    );
    expect(
      pageHintFromUrl("https://www.youtube.com/results?search_query=cats", "Search"),
    ).toBe("results");
    expect(pageHintFromUrl("https://www.youtube.com/", "YouTube")).toBe("home");
  });

  it("registers youtube plugin recovery and workflows", () => {
    const registry = new PluginRegistry();
    expect(registry.list().map((p) => p.id)).toContain("youtube");
    const fixes = registry.recoveryFixes("target_not_found", {
      url: "https://www.youtube.com/watch?v=1",
      title: "Watch",
      domain: "www.youtube.com",
      pageHint: "watch",
      dialogs: [],
      buttons: ["Skip Ad"],
      inputs: [],
      links: [],
      nodes: [],
      signals: ["skip_ad", "video_player"],
      fingerprint: "yt",
      observedAt: new Date().toISOString(),
    });
    expect(fixes.length).toBeGreaterThan(0);
    expect(registry.workflowsFor("www.youtube.com").open_home?.length).toBeGreaterThan(
      0,
    );
    expect(youtubePlugin.domains).toContain("youtube.com");
  });

  it("plans open youtube and search-on-youtube intents", async () => {
    const planner = new BuiltinPlanner();
    const open = await planner.plan("open youtube");
    expect(open?.steps[0]?.action.type).toBe("navigate");

    const search = await planner.plan("search cats on youtube.com");
    expect(search?.steps.some((s) => s.action.type === "type")).toBe(true);
    expect(search?.steps.some((s) => s.action.type === "wait")).toBe(true);
  });

  it("plans run workflow on domain", async () => {
    const planner = new BuiltinPlanner();
    const plan = await planner.plan("run open_home on youtube.com");
    expect(plan?.metadata?.workflow).toBe("open_home");
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
