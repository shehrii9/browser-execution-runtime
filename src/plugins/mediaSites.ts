import type { SitePlugin } from "./types.js";

/**
 * Generic media-site handling (video/audio SPAs).
 * YouTube was the first example; this plugin covers common media hosts with
 * shared patterns: consent walls, late player chrome, skip-ad overlays,
 * search boxes, and infinite result feeds.
 *
 * Does not attempt DRM scrubbing, live chat bots, or platform-specific APIs.
 */
export const MEDIA_SITE_DOMAINS = [
  // YouTube family (example host)
  "youtube.com",
  "www.youtube.com",
  "m.youtube.com",
  "youtu.be",
  "music.youtube.com",
  // Other common media hosts
  "vimeo.com",
  "www.vimeo.com",
  "player.vimeo.com",
  "dailymotion.com",
  "www.dailymotion.com",
  "twitch.tv",
  "www.twitch.tv",
  "m.twitch.tv",
  "rumble.com",
  "www.rumble.com",
  "bitchute.com",
  "www.bitchute.com",
  "odysee.com",
  "www.odysee.com",
  "tiktok.com",
  "www.tiktok.com",
  "soundcloud.com",
  "www.soundcloud.com",
  "open.spotify.com",
  "spotify.com",
] as const;

const PLAYER_CSS =
  "video, audio, .video-js, .html5-video-player, [class*='player'], [data-player], iframe[src*='player'], iframe[src*='video']";

const FEED_ITEM_CSS =
  "article, [data-testid*='video'], [class*='video-item'], [class*='VideoCard'], ytd-video-renderer, ytd-rich-item-renderer, .tw-tower > *, .QueueItem";

export const mediaSitesPlugin: SitePlugin = {
  id: "media-sites",
  domains: [...MEDIA_SITE_DOMAINS],
  recoveryFixes: (problem, state) => {
    if (problem === "cookie_banner" || problem === "dialog_blocking") {
      return [
        [{ type: "click", target: { role: "button", name: "Accept all" } }],
        [{ type: "click", target: { role: "button", name: "Reject all" } }],
        [{ type: "click", target: { role: "button", name: "Accept" } }],
        [{ type: "click", target: { role: "button", name: "Agree" } }],
        [
          {
            type: "click",
            target: {
              css: "button[aria-label*='Accept'], button[aria-label*='Agree']",
            },
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
        [{ type: "media", command: "skip_ad" }],
        [{ type: "click", target: { role: "button", name: "Skip" } }],
        [{ type: "click", target: { text: "Skip Ad" } }],
        [
          { type: "scroll", direction: "down", amount: 400 },
          { type: "wait", settle: true },
        ],
        [{ type: "press", key: "Escape" }, { type: "wait", ms: 500 }],
      ];

      if (
        state.pageHint === "watch" ||
        state.pageHint === "shorts" ||
        state.signals.includes("video_player") ||
        state.signals.includes("audio_player")
      ) {
        fixes.unshift([
          {
            type: "wait",
            target: { css: PLAYER_CSS },
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
    /** Generic: settle + clear overlays on whatever media page is open. */
    ready_player: [
      { type: "wait", settle: true, timeoutMs: 8000 },
      { type: "dismiss_overlays" },
      {
        type: "wait",
        target: { css: PLAYER_CSS },
        timeoutMs: 12000,
      },
      { type: "media", command: "skip_ad" },
      { type: "media", command: "play" },
    ],
    open_watch: [
      { type: "wait", settle: true, timeoutMs: 8000 },
      { type: "dismiss_overlays" },
      {
        type: "wait",
        target: { css: PLAYER_CSS },
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
        untilCss: FEED_ITEM_CSS,
        untilCountAtLeast: 10,
        maxScrolls: 10,
        timeoutMs: 25000,
      },
    ],
    // Convenience homes for common hosts (optional; agents can navigate directly).
    open_youtube: [
      {
        type: "navigate",
        url: "https://www.youtube.com",
        waitUntil: "domcontentloaded",
      },
      { type: "wait", settle: true, timeoutMs: 8000 },
      { type: "dismiss_overlays" },
      { type: "wait", settle: true },
    ],
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
    open_vimeo: [
      {
        type: "navigate",
        url: "https://vimeo.com",
        waitUntil: "domcontentloaded",
      },
      { type: "wait", settle: true, timeoutMs: 8000 },
      { type: "dismiss_overlays" },
      { type: "wait", settle: true },
    ],
    open_twitch: [
      {
        type: "navigate",
        url: "https://www.twitch.tv",
        waitUntil: "domcontentloaded",
      },
      { type: "wait", settle: true, timeoutMs: 8000 },
      { type: "dismiss_overlays" },
      { type: "wait", settle: true },
    ],
    search: [
      { type: "wait", settle: true, timeoutMs: 5000 },
      { type: "dismiss_overlays" },
      { type: "wait", settle: true },
    ],
  },
};

/** @deprecated Use mediaSitesPlugin — YouTube was only the first example host. */
export const youtubePlugin = mediaSitesPlugin;
