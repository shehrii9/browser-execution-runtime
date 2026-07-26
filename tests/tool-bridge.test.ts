import { describe, expect, it, vi } from "vitest";
import { ToolBridge } from "../src/agent/bridge.js";
import { RuntimeClient } from "../src/agent/client.js";

describe("ToolBridge", () => {
  it("routes browser_execute to client.execute", async () => {
    const client = {
      execute: vi.fn(async () => ({ ok: true, goal: "x", steps: [], llmCallsAvoided: 0 })),
    } as unknown as RuntimeClient;
    const bridge = new ToolBridge(client);
    const result = await bridge.handle({
      name: "browser_execute",
      arguments: { intent: "open https://example.com" },
    });
    expect(client.execute).toHaveBeenCalledWith("open https://example.com");
    expect(result).toMatchObject({ ok: true });
  });
});
