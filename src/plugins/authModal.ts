import type { Action } from "../types.js";
import type { SitePlugin } from "./types.js";

/** Universal login/modal helpers for auth walls and newsletter popups. */
export const authModalPlugin: SitePlugin = {
  id: "auth-modal",
  domains: [],
  recoveryFixes: (problem, state) => {
    if (problem !== "dialog_blocking" && problem !== "target_not_found") return [];
    const fixes: Action[][] = [
      [{ type: "press", key: "Escape" }],
      [{ type: "dismiss_overlays" }],
      [{ type: "click", target: { role: "button", name: "Not now" } }],
      [{ type: "click", target: { role: "button", name: "No thanks" } }],
      [{ type: "click", target: { role: "button", name: "Close" } }],
    ];
    if (state.signals.includes("login_available") || state.pageHint === "login") {
      fixes.push([{ type: "wait", ms: 1000 }]);
    }
    return fixes;
  },
};
