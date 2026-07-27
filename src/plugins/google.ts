import type { SitePlugin } from "./types.js";

export const googlePlugin: SitePlugin = {
  id: "google",
  domains: ["google.com", "www.google.com"],
  recoveryFixes: (problem) => {
    if (problem === "cookie_banner" || problem === "dialog_blocking") {
      return [
        [{ type: "click", target: { role: "button", name: "Accept all" } }],
        [{ type: "click", target: { role: "button", name: "Reject all" } }],
        [{ type: "dismiss_overlays" }],
      ];
    }
    if (problem === "target_not_found") {
      return [[{ type: "wait", ms: 800 }], [{ type: "press", key: "Escape" }]];
    }
    return [];
  },
  workflows: {
    search: [
      { type: "navigate", url: "https://www.google.com" },
      { type: "dismiss_overlays" },
    ],
  },
};
