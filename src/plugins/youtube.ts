import type { SitePlugin } from "./types.js";

/**
 * YouTube / YouTube-like SPA handling.
 * Focus: consent walls, late player chrome, skip-ad overlays, search box.
 * Does not attempt full video automation (scrubbing, captions, DRM).
 */
export const youtubePlugin: SitePlugin = {
  id: "youtube",
  domains: [
    "youtube.com",
    "www.youtube.com",
    "m.youtube.com",
    "youtu.be",
    "music.youtube.com",
  ],
  recoveryFixes: (problem, state) => {
    if (problem === "cookie_banner" || problem === "dialog_blocking") {
      return [
        [
          {
            type: "click",
            target: { role: "button", name: "Accept all" },
          },
        ],
        [
          {
            type: "click",
            target: { role: "button", name: "Reject all" },
          },
        ],
        [
          {
            type: "click",
            target: { css: "button[aria-label*='Accept'], tp-yt-paper-button" },
          },
        ],
        [{ type: "dismiss_overlays" }, { type: "wait", settle: true }],
        [{ type: "press", key: "Escape" }, { type: "wait", ms: 400 }],
      ];
    }

    if (problem === "target_not_found") {
      const fixes: ReturnType<NonNullable<SitePlugin["recoveryFixes"]>> = [
        [{ type: "wait", settle: true, timeoutMs: 6000 }],
        [{ type: "dismiss_overlays" }, { type: "wait", settle: true }],
        [
          {
            type: "click",
            target: { role: "button", name: "Skip" },
          },
        ],
        [
          {
            type: "click",
            target: { text: "Skip Ad" },
          },
        ],
        [{ type: "scroll", direction: "down", amount: 400 }, { type: "wait", settle: true }],
        [{ type: "press", key: "Escape" }, { type: "wait", ms: 500 }],
      ];

      if (state.pageHint === "watch") {
        fixes.unshift([
          {
            type: "wait",
            target: { css: "ytd-player, #movie_player, video" },
            timeoutMs: 10000,
          },
        ]);
      }
      return fixes;
    }

    if (problem === "navigation_timeout") {
      return [
        [{ type: "wait", settle: true, timeoutMs: 8000 }],
        [{ type: "wait", ms: 2000 }],
      ];
    }

    return [[{ type: "wait", settle: true }], [{ type: "dismiss_overlays" }]];
  },
  workflows: {
    open_home: [
      {
        type: "navigate",
        url: "https://www.youtube.com",
        waitUntil: "domcontentloaded",
      },
      { type: "wait", settle: true, timeoutMs: 8000 },
      { type: "dismiss_overlays" },
      { type: "wait", settle: true },
    ],
    search: [
      {
        type: "navigate",
        url: "https://www.youtube.com",
        waitUntil: "domcontentloaded",
      },
      { type: "wait", settle: true, timeoutMs: 8000 },
      { type: "dismiss_overlays" },
      { type: "wait", settle: true },
    ],
    open_watch: [
      { type: "wait", settle: true, timeoutMs: 8000 },
      { type: "dismiss_overlays" },
      {
        type: "wait",
        target: { css: "ytd-player, #movie_player, video" },
        timeoutMs: 12000,
      },
      { type: "media", command: "skip_ad" },
      { type: "media", command: "play" },
    ],
    load_more_results: [
      {
        type: "scroll",
        direction: "down",
        amount: 1200,
        untilCss: "ytd-video-renderer, ytd-rich-item-renderer",
        untilCountAtLeast: 12,
        maxScrolls: 10,
        timeoutMs: 25000,
      },
    ],
  },
};
