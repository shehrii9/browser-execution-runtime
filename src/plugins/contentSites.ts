import type { SitePlugin } from "./types.js";

/**
 * Content / article sites (news, blogs, encyclopedias).
 * Focus: consent walls, newsletter modals, settle, article scroll.
 */
export const contentSitesPlugin: SitePlugin = {
  id: "content-sites",
  domains: [
    "bbc.com",
    "www.bbc.com",
    "bbc.co.uk",
    "www.bbc.co.uk",
    "cnn.com",
    "www.cnn.com",
    "nytimes.com",
    "www.nytimes.com",
    "theguardian.com",
    "www.theguardian.com",
    "reuters.com",
    "www.reuters.com",
    "wikipedia.org",
    "en.wikipedia.org",
    "medium.com",
    "www.medium.com",
    "substack.com",
    "www.substack.com",
    "dev.to",
    "hashnode.com",
    "www.hashnode.com",
  ],
  recoveryFixes: (problem) => {
    if (problem === "cookie_banner" || problem === "dialog_blocking") {
      return [
        [{ type: "click", target: { role: "button", name: "Accept all" } }],
        [{ type: "click", target: { role: "button", name: "Accept" } }],
        [{ type: "click", target: { role: "button", name: "Agree" } }],
        [{ type: "click", target: { role: "button", name: "I agree" } }],
        [{ type: "click", target: { role: "button", name: "Continue" } }],
        [{ type: "click", target: { role: "button", name: "No thanks" } }],
        [{ type: "click", target: { role: "button", name: "Not now" } }],
        [
          {
            type: "click",
            target: { role: "button", name: "Accept all", frameUrl: "consent" },
          },
        ],
        [{ type: "dismiss_overlays" }, { type: "wait", settle: true }],
        [{ type: "press", key: "Escape" }],
      ];
    }
    if (problem === "target_not_found") {
      return [
        [{ type: "wait", settle: true, timeoutMs: 5000 }],
        [{ type: "dismiss_overlays" }, { type: "wait", settle: true }],
        [
          { type: "scroll", direction: "down", amount: 500 },
          { type: "wait", settle: true },
        ],
      ];
    }
    return [[{ type: "dismiss_overlays" }], [{ type: "wait", settle: true }]];
  },
  workflows: {
    read_article: [
      { type: "wait", settle: true, timeoutMs: 6000 },
      { type: "dismiss_overlays" },
      { type: "wait", settle: true },
      {
        type: "scroll",
        direction: "down",
        amount: 800,
        untilCss: "article, main, [role='main']",
        untilCountAtLeast: 1,
        maxScrolls: 4,
      },
    ],
    dismiss_chrome: [
      { type: "dismiss_overlays" },
      { type: "press", key: "Escape" },
      { type: "wait", settle: true },
    ],
  },
};
