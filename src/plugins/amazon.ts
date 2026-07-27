import type { SitePlugin } from "./types.js";

/** Lightweight Amazon helpers — recovery only, no purchase automation. */
export const amazonPlugin: SitePlugin = {
  id: "amazon",
  domains: ["amazon.com", "www.amazon.com", "amazon.co.uk"],
  recoveryFixes: (problem, state) => {
    if (problem === "cookie_banner" || problem === "dialog_blocking") {
      return [
        [{ type: "click", target: { role: "button", name: "Accept" } }],
        [{ type: "dismiss_overlays" }],
        [{ type: "press", key: "Escape" }],
      ];
    }
    if (problem === "target_not_found" && state.pageHint === "search") {
      return [
        [{ type: "wait", ms: 1000 }],
        [{ type: "scroll", direction: "down", amount: 700 }],
      ];
    }
    return [];
  },
  workflows: {
    home: [{ type: "navigate", url: "https://www.amazon.com" }],
  },
};
