import type { Action, SemanticState } from "../types.js";
import { inferModalKinds, hasProtectedModal } from "../state/dialogKinds.js";

export type ProblemKind =
  | "cookie_banner"
  | "dialog_blocking"
  | "auth_required"
  | "otp_required"
  | "payment_confirm"
  | "target_not_found"
  | "navigation_timeout"
  | "unknown";

export function classifyProblem(error: string, state?: SemanticState): ProblemKind {
  const msg = error.toLowerCase();
  const modalKinds = state ? inferModalKinds(state) : [];

  if (modalKinds.includes("otp") || state?.signals.some((s) => s === "modal:otp")) {
    return "otp_required";
  }
  if (
    modalKinds.includes("login") ||
    state?.signals.includes("modal:login") ||
    (state?.signals.includes("password_field") && state.signals.includes("has_dialog"))
  ) {
    return "auth_required";
  }
  if (
    modalKinds.includes("payment") ||
    state?.signals.includes("modal:payment") ||
    state?.signals.includes("checkout_available")
  ) {
    if (/purchase|blocked by policy/i.test(msg)) {
      return "payment_confirm";
    }
    if (state?.signals.includes("has_dialog") || state?.dialogs.length) {
      return "payment_confirm";
    }
  }
  if (state?.signals.includes("cookie_banner") || /cookie|consent/.test(msg)) {
    return "cookie_banner";
  }
  if (
    state?.dialogs.length ||
    /dialog|overlay|intercepts pointer|pointer-events/i.test(msg)
  ) {
    if (modalKinds.includes("critical")) {
      return "payment_confirm";
    }
    return "dialog_blocking";
  }
  if (/timeout|waiting for|not found|unable to find/i.test(msg)) {
    return "target_not_found";
  }
  if (/navigation|net::|goto/i.test(msg)) {
    return "navigation_timeout";
  }
  return "unknown";
}

export function heuristicFixes(problem: ProblemKind): Action[][] {
  switch (problem) {
    case "auth_required":
    case "otp_required":
      // Agent must supply credentials / OTP — do not dismiss login modals.
      return [
        [{ type: "wait", settle: true, timeoutMs: 3000 }],
        [{ type: "wait", ms: 1500 }],
      ];
    case "payment_confirm":
      return [
        [{ type: "wait", settle: true, timeoutMs: 2000 }],
        [{ type: "press", key: "Escape" }],
      ];
    case "cookie_banner":
      return [
        [{ type: "dismiss_overlays" }],
        [
          { type: "dismiss_overlays" },
          { type: "wait", ms: 500 },
        ],
        [
          {
            type: "click",
            target: { role: "button", name: "Accept all" },
          },
        ],
        [
          {
            type: "click",
            target: {
              role: "button",
              name: "Accept all",
              frame: "iframe",
            },
          },
        ],
        [
          {
            type: "click",
            target: {
              role: "button",
              name: "Accept",
              frameUrl: "consent",
            },
          },
        ],
      ];
    case "dialog_blocking":
      return [
        [{ type: "dismiss_overlays" }],
        [{ type: "press", key: "Escape" }, { type: "dismiss_overlays" }],
        [{ type: "click", target: { role: "button", name: "Close" } }],
        [
          {
            type: "click",
            target: { role: "button", name: "Accept all", frame: "iframe" },
          },
        ],
        [{ type: "click", target: { role: "button", name: "Not now" } }],
        [{ type: "click", target: { role: "button", name: "No thanks" } }],
      ];
    case "target_not_found":
      return [
        [{ type: "wait", settle: true, timeoutMs: 4000 }],
        [{ type: "wait", ms: 1000 }],
        [{ type: "dismiss_overlays" }, { type: "wait", settle: true }],
        [{ type: "scroll", direction: "down", amount: 600 }],
        [{ type: "press", key: "Escape" }, { type: "wait", ms: 300 }],
      ];
    case "navigation_timeout":
      return [
        [{ type: "wait", settle: true, timeoutMs: 5000 }],
        [{ type: "wait", ms: 1500 }],
        [{ type: "press", key: "F5" }],
      ];
    default:
      return [
        [{ type: "dismiss_overlays" }],
        [{ type: "wait", settle: true }],
        [{ type: "wait", ms: 800 }],
      ];
  }
}

export function shouldAttemptDismissOverlays(state?: SemanticState): boolean {
  if (!state) return true;
  const kinds = inferModalKinds(state);
  return !hasProtectedModal(kinds);
}
