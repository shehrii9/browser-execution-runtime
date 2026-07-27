export const AGENT_TOOLS = [
  {
    type: "function",
    function: {
      name: "browser_attach",
      description:
        "Attach/launch the browser execution runtime. Prefer this over computer-use.",
      parameters: {
        type: "object",
        properties: {
          startUrl: { type: "string" },
          cdpUrl: { type: "string", description: "Connect to existing Chrome CDP endpoint" },
          userDataDir: {
            type: "string",
            description: "Persistent Chrome profile directory",
          },
          profile: {
            type: "string",
            description: "Convenience profile key: ephemeral | persistent",
          },
          headless: { type: "boolean" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "browser_execute",
      description:
        "Give a high-level intent. Runtime planner converts it to actions and executes with recovery/memory.",
      parameters: {
        type: "object",
        required: ["intent"],
        properties: {
          intent: { type: "string" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "browser_run_plan",
      description: "Execute an explicit deterministic browser plan JSON.",
      parameters: {
        type: "object",
        required: ["plan"],
        properties: {
          plan: { type: "object" },
          resumeFromStep: { type: "integer", minimum: 0 },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "browser_observe",
      description:
        "Return compact semantic browser state (not screenshots) for cheap reasoning.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "browser_diff",
      description: "Return what changed since the last observation.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "browser_resume",
      description: "Resume the last failed plan from its failure step.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "browser_status",
      description: "Runtime status including memory engine and experience counts.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "browser_tabs",
      description: "List open browser tabs managed by the runtime.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "browser_events",
      description:
        "List recent runtime events (attach, steps, recovery, run_start/end). Useful instead of screenshots.",
      parameters: {
        type: "object",
        properties: {
          afterId: { type: "integer", minimum: 0 },
          limit: { type: "integer", minimum: 1 },
          type: { type: "string" },
        },
      },
    },
  },
] as const;

export type AgentToolName = (typeof AGENT_TOOLS)[number]["function"]["name"];

/** @deprecated Use AGENT_TOOLS */
export const HERMES_TOOLS = AGENT_TOOLS;
/** @deprecated Use AgentToolName */
export type HermesToolName = AgentToolName;
