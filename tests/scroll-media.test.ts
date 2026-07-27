import { describe, expect, it } from "vitest";
import { ActionSchema } from "../src/types.js";
import { youtubePlugin } from "../src/plugins/youtube.js";

describe("scroll until + media actions", () => {
  it("parses infinite-scroll scroll action", () => {
    const action = ActionSchema.parse({
      type: "scroll",
      direction: "down",
      amount: 1000,
      untilCss: "ytd-video-renderer",
      untilCountAtLeast: 12,
      maxScrolls: 10,
      timeoutMs: 20000,
    });
    expect(action.type).toBe("scroll");
    if (action.type === "scroll") {
      expect(action.untilCountAtLeast).toBe(12);
      expect(action.untilCss).toBe("ytd-video-renderer");
    }
  });

  it("parses media commands", () => {
    for (const command of [
      "play",
      "pause",
      "toggle",
      "mute",
      "unmute",
      "skip_ad",
      "fullscreen",
    ] as const) {
      const action = ActionSchema.parse({ type: "media", command });
      expect(action).toEqual({ type: "media", command });
    }
  });

  it("exposes YouTube load_more_results and play-capable open_watch", () => {
    const load = youtubePlugin.workflows?.load_more_results ?? [];
    expect(load.some((a) => a.type === "scroll")).toBe(true);
    const watch = youtubePlugin.workflows?.open_watch ?? [];
    expect(watch.some((a) => a.type === "media")).toBe(true);
  });
});
