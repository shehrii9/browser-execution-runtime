/**
 * Canonical mapping from agent tool names → BER daemon HTTP routes.
 * Used by docs, bridges, and integration examples.
 */
export const TOOL_HTTP_ROUTES = {
  browser_attach: { method: "POST", path: "/attach" },
  browser_execute: { method: "POST", path: "/execute" },
  browser_run_plan: { method: "POST", path: "/run" },
  browser_observe: { method: "GET", path: "/observe" },
  browser_diff: { method: "GET", path: "/diff" },
  browser_resume: { method: "POST", path: "/resume" },
  browser_status: { method: "GET", path: "/status" },
  browser_tabs: { method: "GET", path: "/tabs" },
} as const;

export type RoutedToolName = keyof typeof TOOL_HTTP_ROUTES;

export function listRoutedToolNames(): RoutedToolName[] {
  return Object.keys(TOOL_HTTP_ROUTES) as RoutedToolName[];
}

export function getToolRoute(name: string): (typeof TOOL_HTTP_ROUTES)[RoutedToolName] {
  if (!(name in TOOL_HTTP_ROUTES)) {
    throw new Error(`Unknown browser tool route: ${name}`);
  }
  return TOOL_HTTP_ROUTES[name as RoutedToolName];
}
