import type { SitePlugin } from "./types.js";

export const githubPlugin: SitePlugin = {
  id: "github",
  domains: ["github.com"],
  recoveryFixes: (problem, state) => {
    if (problem === "dialog_blocking" || problem === "cookie_banner") {
      return [
        [{ type: "dismiss_overlays" }],
        [{ type: "click", target: { role: "button", name: "Accept" } }],
      ];
    }
    if (problem === "target_not_found") {
      if (state.pageHint === "login" || state.signals.includes("login_available")) {
        return [
          [{ type: "wait", ms: 800 }],
          [{ type: "click", target: { role: "button", name: "Sign in" } }],
        ];
      }
      return [
        [{ type: "wait", ms: 800 }],
        [{ type: "click", target: { role: "button", name: "Code" } }],
      ];
    }
    return [];
  },
  workflows: {
    openNotifications: [
      { type: "navigate", url: "https://github.com/notifications" },
      { type: "wait", ms: 1000 },
    ],
    openPullRequests: [
      { type: "navigate", url: "https://github.com/pulls" },
      { type: "wait", ms: 1000 },
    ],
  },
};
