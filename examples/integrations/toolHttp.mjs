/**
 * Shared HTTP helper for calling BER tools from JS agents.
 * Keep this aligned with src/agent/toolRoutes.ts.
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
  browser_events: { method: "GET", path: "/events" },
};

export async function callBerTool(baseUrl, name, args = {}, fetchImpl = fetch) {
  const route = TOOL_HTTP_ROUTES[name];
  if (!route) throw new Error(`Unknown tool ${name}`);
  const base = String(baseUrl).replace(/\/$/, "");
  if (route.method === "GET") {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(args ?? {})) {
      if (value !== undefined && value !== null && value !== "") {
        params.set(key, String(value));
      }
    }
    const qs = params.toString();
    const res = await fetchImpl(`${base}${route.path}${qs ? `?${qs}` : ""}`);
    return res.json();
  }
  const body =
    name === "browser_run_plan"
      ? args
      : name === "browser_execute"
        ? args
        : name === "browser_attach"
          ? args
          : args;
  const res = await fetchImpl(`${base}${route.path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body ?? {}),
  });
  return res.json();
}
