import type { Action } from "../types.js";
import type { SitePlugin } from "./types.js";
import { inferModalKinds } from "../state/dialogKinds.js";

/** Login / newsletter modals — never auto-dismiss OTP or payment walls. */
export const authModalPlugin: SitePlugin = {
  id: "auth-modal",
  domains: [],
  recoveryFixes: (problem, state) => {
    const kinds = inferModalKinds(state);
    if (kinds.includes("otp") || kinds.includes("payment") || kinds.includes("critical")) {
      return [];
    }
    if (kinds.includes("login")) {
      return [[{ type: "wait", settle: true, timeoutMs: 2500 }]];
    }
    if (problem !== "dialog_blocking" && problem !== "target_not_found") return [];
    const fixes: Action[][] = [
      [{ type: "press", key: "Escape" }],
      [{ type: "dismiss_overlays" }],
      [{ type: "click", target: { role: "button", name: "Not now" } }],
      [{ type: "click", target: { role: "button", name: "No thanks" } }],
      [{ type: "click", target: { role: "button", name: "Close" } }],
    ];
    return fixes;
  },
};
