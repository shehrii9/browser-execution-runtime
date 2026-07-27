import { defaultPersistentProfileDir } from "../browser/profiles.js";
import type { Plan } from "../types.js";
import { RuntimeClient } from "./client.js";
import { getToolRoute } from "./toolRoutes.js";
import type { AgentToolName } from "./tools.js";

export interface ToolCall {
  name: string;
  arguments: Record<string, unknown>;
}

/**
 * Maps any agent tool-calls onto the local browser runtime daemon.
 * Works with Hermes, OpenAI tools, custom agents, scripts, etc.
 */
export class ToolBridge {
  constructor(private readonly client: RuntimeClient) {}

  async handle(call: ToolCall): Promise<unknown> {
    const name = call.name as AgentToolName;
    const args = call.arguments ?? {};
    // Validate against canonical route table (shared with Cursor/Codex docs).
    getToolRoute(name);

    switch (name) {
      case "browser_attach": {
        const profile = typeof args.profile === "string" ? args.profile : undefined;
        const userDataDir =
          typeof args.userDataDir === "string"
            ? args.userDataDir
            : profile === "persistent"
              ? defaultPersistentProfileDir()
              : undefined;
        return this.client.attach({
          startUrl: asString(args.startUrl),
          cdpUrl: asString(args.cdpUrl),
          userDataDir,
          headless: typeof args.headless === "boolean" ? args.headless : undefined,
        });
      }
      case "browser_execute": {
        const intent = asString(args.intent);
        if (!intent) throw new Error("browser_execute requires intent");
        return this.client.execute(intent);
      }
      case "browser_run_plan": {
        if (!args.plan || typeof args.plan !== "object") {
          throw new Error("browser_run_plan requires plan object");
        }
        return this.client.run(
          args.plan as Plan,
          typeof args.resumeFromStep === "number" ? args.resumeFromStep : undefined,
        );
      }
      case "browser_observe":
        return this.client.observe();
      case "browser_diff":
        return this.client.diff();
      case "browser_resume":
        return this.client.resume();
      case "browser_status":
        return this.client.status();
      case "browser_tabs":
        return this.client.tabs();
      case "browser_events":
        return this.client.events({
          afterId: typeof args.afterId === "number" ? args.afterId : undefined,
          limit: typeof args.limit === "number" ? args.limit : undefined,
          type: asString(args.type),
        });
      default:
        throw new Error(`Unknown browser tool: ${call.name}`);
    }
  }
}

export function createDefaultBridge(baseUrl?: string): ToolBridge {
  return new ToolBridge(
    new RuntimeClient({
      baseUrl: baseUrl ?? process.env.BER_URL ?? "http://127.0.0.1:8787",
    }),
  );
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

/** @deprecated Use ToolBridge */
export const HermesToolBridge = ToolBridge;
