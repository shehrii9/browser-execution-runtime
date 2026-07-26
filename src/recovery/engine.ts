import type { Action, SemanticState } from "../types.js";

export type ProblemKind =
  | "cookie_banner"
  | "dialog_blocking"
  | "target_not_found"
  | "navigation_timeout"
  | "unknown";

export function classifyProblem(error: string, state?: SemanticState): ProblemKind {
  const msg = error.toLowerCase();
  if (state?.signals.includes("cookie_banner") || /cookie|consent/.test(msg)) {
    return "cookie_banner";
  }
  if (state?.dialogs.length || /dialog|overlay|intercepts pointer/i.test(msg)) {
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
      ];
    case "dialog_blocking":
      return [
        [{ type: "dismiss_overlays" }],
        [{ type: "press", key: "Escape" }, { type: "dismiss_overlays" }],
        [{ type: "click", target: { role: "button", name: "Close" } }],
      ];
    case "target_not_found":
      return [
        [{ type: "wait", ms: 1000 }],
        [{ type: "dismiss_overlays" }, { type: "wait", ms: 500 }],
        [{ type: "scroll", direction: "down", amount: 600 }],
        [{ type: "press", key: "Escape" }, { type: "wait", ms: 300 }],
      ];
    case "navigation_timeout":
      return [[{ type: "wait", ms: 1500 }], [{ type: "press", key: "F5" }]];
    default:
      return [[{ type: "dismiss_overlays" }], [{ type: "wait", ms: 800 }]];
  }
}
