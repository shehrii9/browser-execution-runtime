import type { SitePlugin } from "./types.js";

export const cookieConsentPlugin: SitePlugin = {
  id: "cookie-consent",
  domains: [],
  recoveryFixes: (problem) => {
    if (problem !== "cookie_banner" && problem !== "dialog_blocking") return [];
    return [
      [{ type: "dismiss_overlays" }],
      [{ type: "click", target: { role: "button", name: "Accept all" } }],
      [{ type: "click", target: { role: "button", name: "Accept" } }],
      [{ type: "click", target: { role: "button", name: "I agree" } }],
      [{ type: "click", target: { role: "button", name: "Got it" } }],
    ];
  },
  workflows: {
    dismissCookies: [{ type: "dismiss_overlays" }],
  },
};
